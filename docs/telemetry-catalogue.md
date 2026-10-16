# AutoHeal AI — Telemetry & Metrics Catalogue
**Phase 3: Observability, Metrics, Tracing, and Alerting Dictionary**  
**Version:** 1.0.0  
**Date:** October 16, 2026  
**Status:** Canonical Reference  

---

## 1. Overview & Semantic Conventions

This document defines the complete telemetry schema emitted by the AutoHeal AI microservice ecosystem. All metrics follow the OpenMetrics / Prometheus standard, and distributed trace spans adhere to the OpenTelemetry Semantic Conventions v1.43+.

---

## 2. Metric Dictionary by Service

### 2.1 API Gateway (`api-gateway`)
- **Runtime:** Node.js 20 / Express 5
- **Library:** `prom-client` v15.1.3
- **Exposition Endpoint:** `http://api-gateway:3000/metrics`

| Metric Name | Type | Unit | Labels | Description & PromQL Example |
|---|---|---|---|---|
| `http_requests_total` | Counter | Requests | `method`, `route`, `status_code` | Total HTTP requests handled by the API gateway.<br>`sum(rate(http_requests_total[1m])) by (status_code)` |
| `http_request_duration_seconds` | Histogram | Seconds | `method`, `route`, `status_code`, `le` | Distribution of request latency through the gateway.<br>`histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[1m])) by (le))` |
| `gateway_downstream_duration_seconds` | Histogram | Seconds | `target_service`, `status_code`, `le` | Outbound request duration to downstream services (`web-service`, `ai-service`).<br>`sum(rate(gateway_downstream_duration_seconds_count[1m])) by (target_service, status_code)` |
| `nodejs_eventloop_lag_seconds` | Gauge | Seconds | — | Latency of the Node.js event loop indicating I/O starvation.<br>`nodejs_eventloop_lag_seconds` |
| `process_cpu_user_seconds_total` | Counter | Seconds | — | User CPU time spent by the gateway process.<br>`rate(process_cpu_user_seconds_total[1m]) * 100` |
| `process_resident_memory_bytes` | Gauge | Bytes | — | Resident Set Size (RSS) memory consumption.<br>`process_resident_memory_bytes / 1024 / 1024` (MB) |

---

### 2.2 Spring Boot Web Service (`web-service`)
- **Runtime:** Temurin JRE 21 / Spring Boot 4.1.1
- **Library:** `micrometer-registry-prometheus`
- **Exposition Endpoint:** `http://web-service:8080/actuator/prometheus`

| Metric Name | Type | Unit | Labels | Description & PromQL Example |
|---|---|---|---|---|
| `http_server_requests_seconds_count` | Counter | Requests | `uri`, `status`, `method`, `application` | Total HTTP requests processed by Spring MVC.<br>`sum(rate(http_server_requests_seconds_count[1m]))` |
| `http_server_requests_seconds_bucket` | Histogram | Seconds | `uri`, `status`, `method`, `application`, `le` | Percentile histogram of Spring Boot HTTP request latencies.<br>`histogram_quantile(0.99, sum(rate(http_server_requests_seconds_bucket[1m])) by (le))` |
| `jvm_memory_used_bytes` | Gauge | Bytes | `area`, `id` (`heap`, `nonheap`) | JVM memory allocated and currently in use.<br>`sum(jvm_memory_used_bytes{area="heap"}) / 1024 / 1024` (MB) |
| `jvm_memory_max_bytes` | Gauge | Bytes | `area`, `id` | Max allowable JVM memory ceiling before OutOfMemoryError.<br>`jvm_memory_max_bytes{area="heap"} / 1024 / 1024` (MB) |
| `jvm_threads_live_threads` | Gauge | Threads | — | Number of active Java platform threads.<br>`jvm_threads_live_threads` |
| `process_cpu_usage` | Gauge | Ratio (0-1) | — | Process-level CPU utilization for the JVM.<br>`process_cpu_usage * 100` (%) |

---

### 2.3 FastAPI AI Service (`ai-service`)
- **Runtime:** Python 3.11 Slim / FastAPI 0.143.2
- **Library:** `prometheus-fastapi-instrumentator` v8.1.0
- **Exposition Endpoint:** `http://ai-service:8000/metrics`

| Metric Name | Type | Unit | Labels | Description & PromQL Example |
|---|---|---|---|---|
| `http_requests_total` | Counter | Requests | `handler`, `method`, `status` | Total incoming FastAPI requests.<br>`sum(rate(http_requests_total[1m])) by (handler)` |
| `http_request_duration_seconds_bucket` | Histogram | Seconds | `handler`, `method`, `status`, `le` | FastAPI request duration histogram.<br>`histogram_quantile(0.90, sum(rate(http_request_duration_seconds_bucket[1m])) by (le))` |
| `process_resident_memory_bytes` | Gauge | Bytes | — | Python process memory consumption in bytes.<br>`process_resident_memory_bytes / 1024 / 1024` (MB) |
| `process_cpu_seconds_total` | Counter | Seconds | — | Total user and system CPU time consumed by Python.<br>`rate(process_cpu_seconds_total[1m]) * 100` |
| `process_open_fds` | Gauge | Count | — | Number of open file descriptors in the Python process.<br>`process_open_fds` |

---

### 2.4 OpenTelemetry Collector (`otel-collector`)
- **Runtime:** OpenTelemetry Collector Contrib 0.111.0
- **Exposition Endpoint:** `http://otel-collector:8888/metrics`

| Metric Name | Type | Unit | Description |
|---|---|---|---|
| `otelcol_receiver_accepted_spans` | Counter | Spans | Number of trace spans successfully ingested via OTLP gRPC/HTTP. |
| `otelcol_receiver_refused_spans` | Counter | Spans | Number of spans rejected due to invalid payloads or rate limits. |
| `otelcol_processor_dropped_spans` | Counter | Spans | Spans dropped by processors (e.g. `memory_limiter` activation). |
| `otelcol_exporter_sent_spans` | Counter | Spans | Spans successfully transmitted to Grafana Tempo. |
| `otelcol_process_memory_rss` | Gauge | Bytes | Memory consumption of the collector process. |

---

## 3. Distributed Tracing Semantic Conventions

All trace spans emitted across the distributed system use the W3C Trace Context recommendation (`traceparent` format: `00-{trace_id}-{span_id}-{trace_flags}`).

### 3.1 Span Structure & Hierarchy

When an external request enters the system (e.g., `GET /api/web/health`), the resulting trace graph follows this schema:

```
[Trace: 32-char hex trace_id]
  └── Span 1: "GET /api/web/health" (SPAN_KIND_SERVER) [Service: api-gateway]
        ├── Span 2: "router - /api/web/health" (SPAN_KIND_INTERNAL) [Service: api-gateway]
        ├── Span 3: "fetch http://web-service:8080/health" (SPAN_KIND_CLIENT) [Service: api-gateway]
        │     │  (W3C traceparent header injected into HTTP request)
        │     ▼
        └── Span 4: "GET /health" (SPAN_KIND_SERVER) [Service: web-service]
              └── Span 5: "healthCheckExecution" (SPAN_KIND_INTERNAL) [Service: web-service]
```

### 3.2 Standard Span Attributes

| Attribute Name | Example Value | Description |
|---|---|---|
| `service.name` | `api-gateway`, `web-service`, `ai-service` | Logical service producing the span |
| `http.request.method` | `GET`, `POST` | HTTP request verb |
| `http.response.status_code` | `200`, `503` | HTTP response code returned |
| `http.route` | `/health`, `/api/web/health` | Templated route matched |
| `server.address` | `web-service`, `localhost` | Downstream server address |
| `server.port` | `8080`, `8000`, `3000` | Target TCP port |
| `error` | `true` (when status >= 500) | Error flag for quick filtering in Tempo |

---

## 4. Alerting Rules Catalogue

Configured in `monitoring/prometheus/alert_rules.yml`:

| Alert Name | Expression (PromQL) | Threshold / Duration | Severity | Action Triggered |
|---|---|---|---|---|
| **ServiceDown** | `up{job=~"api-gateway\|web-service\|ai-service"} == 0` | Unavailable for > 15 seconds | **Critical** | Triggers automated health audit and alerts operator. |
| **HighHttpErrorRate** | `sum(rate(http_requests_total{status_code=~"5.."}[1m])) / sum(rate(http_requests_total[1m])) > 0.05` | 5xx errors > 5% over 1 min | **Warning** | Flags downstream dependency degraded. |
| **HighHttpLatency** | `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[1m])) by (le)) > 0.5` | p95 latency > 500ms for 30s | **Warning** | Flags saturation, thread pool exhaustion, or downstream hang. |
