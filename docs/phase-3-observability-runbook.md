# AutoHeal AI — Phase 3 Observability Operations Runbook
**Phase 3: SRE Operational Guide, Dashboard Usage, Alerting & Tracing Runbook**  
**Version:** 1.0.0  
**Date:** October 16, 2026  
**Audience:** SREs, Platform Engineers, and AutoHeal AI Operators  

---

## 1. Quick Access Cheatsheet

| Component | Web UI / API URL | Default Credentials | Description |
|---|---|---|---|
| **Grafana Dashboards** | [http://localhost:3001](http://localhost:3001) | `admin` / `autoheal_grafana_2026` | Unified SRE dashboards and trace visualizer |
| **Prometheus Web UI** | [http://localhost:9090](http://localhost:9090) | *(None / Direct access)* | Metric queries, target statuses, alerting rules |
| **Tempo API** | [http://localhost:3200](http://localhost:3200) | *(None / API access)* | Distributed trace search and retrieval engine |
| **OTel Collector Health**| [http://localhost:13133](http://localhost:13133) | *(None / Health probe)* | Core pipeline liveness probe |
| **API Gateway Metrics** | [http://localhost:3000/metrics](http://localhost:3000/metrics) | *(None / Direct scrape)* | Node.js gateway prometheus endpoint |
| **Web Service Metrics** | [http://localhost:8080/actuator/prometheus](http://localhost:8080/actuator/prometheus) | *(None / Direct scrape)* | Spring Boot actuator metrics endpoint |
| **AI Service Metrics** | [http://localhost:8000/metrics](http://localhost:8000/metrics) | *(None / Direct scrape)* | FastAPI prometheus endpoint |

---

## 2. Standard Operating Procedures (SOPs)

### SOP-01: Verifying Scrape Targets Health
When metrics in Grafana appear stale or flat:
1. Open terminal and run:
   ```bash
   curl.exe -s http://localhost:9090/api/v1/targets | jq .data.activeTargets[].health
   ```
2. Verify all targets return `"up"`.
3. If any target reports `"down"`, check the `lastError` field:
   - `connection refused`: The target container crashed or did not expose the port.
   - `context deadline exceeded`: The service is overloaded or frozen. Scrape timeout is 4 seconds.
4. Check target container logs:
   ```bash
   docker logs autoheal-web-service --tail 50
   ```

---

### SOP-02: Querying Traces in Grafana Tempo
To find slow requests or 5xx errors across microservices:
1. Navigate to Grafana at [http://localhost:3001](http://localhost:3001) and log in.
2. Select **Explore** from the sidebar (or press `g` then `e`).
3. Set the datasource dropdown at the top to **Tempo**.
4. Choose the **Search** tab.
5. In the search form:
   - **Service Name**: Select `api-gateway`
   - **Span Name**: Select `GET /health` or `request handler - /api/web/health`
   - **Min Duration**: e.g., `100ms` (to find latency outliers)
   - Click **Run query**.
6. Click any Trace ID in the results to open the interactive waterfall trace viewer showing spans across Node.js, Spring Boot, and FastAPI.

---

### SOP-03: Investigating Active Prometheus Alerts
When a high-severity alert triggers:
1. Inspect active alerts in terminal:
   ```bash
   curl.exe -s http://localhost:9090/api/v1/alerts | jq .data.alerts
   ```
2. Or view via browser at [http://localhost:9090/alerts](http://localhost:9090/alerts).
3. If `ServiceDown` is firing:
   - Check container status: `docker compose ps`
   - Restart the degraded container: `docker compose restart <service-name>`
   - Verify alert resolves (`"alerts": []`) within 15 seconds.
4. If `HighHttpErrorRate` is firing:
   - Identify which downstream service is returning 5xx:
     ```promql
     sum(rate(gateway_downstream_duration_seconds_count{status_code=~"5.."}[1m])) by (target_service)
     ```
   - Check if the downstream service database connection is exhausted.

---

### SOP-04: Investigating Telemetry Buffer Drops
If traces are not arriving in Tempo:
1. Check OpenTelemetry Collector internal metrics:
   ```bash
   curl.exe -s http://localhost:8888/metrics | grep otelcol_processor_dropped_spans
   ```
2. Check collector container logs:
   ```bash
   docker logs autoheal-otel-collector --tail 100
   ```
3. If spans are being dropped by `memory_limiter`:
   - Increase host memory allocation to Docker Desktop.
   - Or increase `batch` size in `monitoring/otel-collector/otel-collector-config.yml` from `256` to `512`.
   - Reload collector: `docker compose restart otel-collector`.

---

## 3. Maintenance & Storage Management

### Adjusting Metric Retention
By default, Prometheus retains 15 days of TSDB history. To change retention:
1. Open `docker-compose.yml`.
2. Locate service `prometheus` and modify command flag:
   ```yaml
   - "--storage.tsdb.retention.time=30d"
   ```
3. Restart Prometheus: `docker compose up -d prometheus`.

### Adjusting Scrape Intervals
By default, Prometheus scrapes every 5 seconds. In production or lower-spec environments:
1. Edit `monitoring/prometheus/prometheus.yml`:
   ```yaml
   global:
     scrape_interval: 10s
   ```
2. Trigger hot reload without restarting container:
   ```bash
   curl.exe -X POST http://localhost:9090/-/reload
   ```

### Clearing Observability Volumes
To perform a complete clean slate wipe of all historical metrics and traces:
```bash
docker compose down
docker volume rm autoheal_prometheus_data autoheal_tempo_data autoheal_grafana_data
docker compose up -d
```
All dashboards and datasources will automatically re-provision from version control on startup.
