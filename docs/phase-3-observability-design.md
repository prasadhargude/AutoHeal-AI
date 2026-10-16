# AutoHeal AI — Phase 3 Observability Architecture & Design Specification
**Phase 3: Industry-Grade Observability, Telemetry, Distributed Tracing, Metrics, and Operational Dashboards**  
**Lead Architect:** Principal Platform & Reliability Engineer  
**Date:** October 16, 2026  
**Status:** Approved & Implemented  

---

## 1. Executive Overview & Design Goals

AutoHeal AI is an autonomous, self-healing microservice platform designed to monitor distributed applications, detect anomalous fault events, diagnose root causes using AI, and execute deterministic recovery workflows.

Phase 3 establishes an enterprise-grade observability framework that transforms AutoHeal AI from a containerized application into a fully observable, research-ready distributed system. The telemetry foundation provides the empirical ground truth required for autonomous root-cause localization, anomaly classification, and closed-loop remediation in Phase 4.

### Key Architectural Tenets
1. **Separation of Concerns & Decoupling**: Application runtimes generate standardized telemetry (OTLP/Prometheus) without knowledge of downstream storage engines. OpenTelemetry Collector acts as the central ingestion router and buffer.
2. **Standardized Propagation**: End-to-end distributed tracing using W3C Trace Context (`traceparent` header propagation) across Express (Node.js), Spring Boot (Java), and FastAPI (Python).
3. **High Fidelity & Resource Safety**: Sub-second metric scrape intervals (5s) for rapid fault detection combined with memory-bounded buffers (`memory_limiter` processor) to protect against telemetry-induced OOM conditions.
4. **Unified Single-Pane-of-Glass**: Grafana 11 with automated file-based provisioning for Prometheus metrics and Tempo traces, featuring bidirectional trace-to-metrics cross-navigation.

---

## 2. Architecture & Data Flow

```
[ Client / Browser ]
        │
        ▼ HTTP :80
  ┌──────────────┐
  │   frontend   │
  │ (Nginx 1.27) │
  └──────┬───────┘
         │ /api/*
         ▼ HTTP :3000
  ┌──────────────────────────────────────────────────────────────────┐
  │                       autoheal-api-gateway                       │
  │     (Express 5 / Node.js 20 / prom-client / OpenTelemetry SDK)   │
  └──────┬────────────────────────────────────────────────────┬──────┘
         │ W3C traceparent (:8080)                            │ W3C traceparent (:8000)
         ▼                                                    ▼
  ┌─────────────────────────────┐                     ┌─────────────────────────────┐
  │     autoheal-web-service    │                     │     autoheal-ai-service     │
  │ (Spring Boot 4 / Java 21)   │                     │  (FastAPI / Python 3.11)    │
  │  Micrometer Tracing Bridge  │                     │  FastAPIInstrumentor + OTLP │
  └──────────────┬──────────────┘                     └──────────────┬──────────────┘
                 │ SQL (:5432)                                       │
                 ▼                                                   │
  ┌─────────────────────────────┐                                    │
  │      autoheal-postgres      │                                    │
  │       (PostgreSQL 16)       │                                    │
  └─────────────────────────────┘                                    │
                                                                     │
  ========================= TELEMETRY INGESTION PIPELINE ============│================
                                                                     │
       [web-service]                  [api-gateway]            [ai-service]
             │ (OTLP HTTP :4318)            │ (OTLP HTTP :4318)      │ (OTLP HTTP :4318)
             └──────────────────────┬───────┴────────────────────────┘
                                    ▼
                     ┌─────────────────────────────┐
                     │   autoheal-otel-collector   │
                     │  (OTel Collector Contrib)   │
                     │  - memory_limiter (75%/20%) │
                     │  - batch (256 spans / 1s)   │
                     └──────────────┬──────────────┘
                                    │ OTLP gRPC (:4317)
                                    ▼
                     ┌─────────────────────────────┐
                     │        autoheal-tempo       │
                     │      (Grafana Tempo)        │
                     │  - Local block storage      │
                     │  - TraceQL engine (:3200)   │
                     └──────────────▲──────────────┘
                                    │
  ========================= METRIC SCRAPE & QUERY PIPELINE ==========│================
                                    │
  ┌─────────────────────────────────┴────────────────────────────────────────────────┐
  │                              autoheal-prometheus                                 │
  │  Scrapes (every 5s):                                                             │
  │   - api-gateway:3000/metrics                                                     │
  │   - web-service:8080/actuator/prometheus                                         │
  │   - ai-service:8000/metrics                                                      │
  │   - otel-collector:8888/metrics                                                  │
  │   - localhost:9090/metrics                                                       │
  │  Evaluates Alert Rules: ServiceDown, HighHttpErrorRate, HighHttpLatency          │
  └─────────────────────────────────┬────────────────────────────────────────────────┘
                                    │ PromQL / Target queries
                                    ▼
  ┌──────────────────────────────────────────────────────────────────────────────────┐
  │                               autoheal-grafana                                   │
  │  - Datasources: Prometheus (:9090), Tempo (:3200)                                │
  │  - Provisioned Dashboards: System Overview & Service Deep Dive                   │
  │  - User: admin / autoheal_grafana_2026 (Port :3001)                              │
  └──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Selection Rationale

| Layer | Selected Technology | Evaluated Alternatives | Selection Rationale |
|---|---|---|---|
| **Distributed Tracing Backend** | **Grafana Tempo 2.6.1** | Jaeger, Zipkin, Elasticsearch | High ingestion efficiency, zero external DB dependencies, stores traces directly in local append-only blocks, native TraceQL integration with Grafana. |
| **Telemetry Collector** | **OpenTelemetry Collector Contrib 0.111.0** | Vector, FluentBit, Direct to Tempo | Vendor-neutral industry standard; decoupled pipeline protects backends via `memory_limiter` and `batch` processors; supports multi-protocol ingestion (gRPC & HTTP). |
| **Metrics Engine** | **Prometheus 2.54.1** | VictoriaMetrics, InfluxDB | De-facto standard for cloud-native microservices; pull model prevents backpressure crashes on application services; rich PromQL query capabilities. |
| **Visualization & Dashboards** | **Grafana 11.3.0** | Prometheus Web UI, Kibana | Native multi-datasource support; seamless correlation between metrics (Prometheus) and traces (Tempo) with exemplar linking and service map graph support. |
| **Node.js Tracing** | **@opentelemetry/sdk-node** | OpenTracing, Elastic APM | Official OpenTelemetry SDK for Node.js; automatic zero-code monkey patching of Express and HTTP modules via `NODE_OPTIONS="--require ./tracing.js"`. |
| **Java Tracing** | **Micrometer Tracing Bridge OTel** | OpenTelemetry Java Agent | Native integration into Spring Boot 4 / Micrometer 1.17; zero external agent jar overhead; automatic propagation in WebClient and RestTemplate. |
| **Python Tracing** | **FastAPIInstrumentor + OTLP Exporter** | Jaeger Client, Elastic APM | Fully native OpenTelemetry Python implementation; automatic W3C traceparent extraction and context propagation across async event loops. |

---

## 4. Port Allocation & Network Topography

All services communicate internally across the private bridge network `autoheal-network`. To avoid port collisions on developer workstations and host machines, the following external port mappings are established:

| Service | Container Name | Internal Port | Host Port | Protocol | Purpose |
|---|---|---|---|---|---|
| Frontend | `autoheal-frontend` | `80` | `80` | HTTP | Production UI & API reverse proxy |
| API Gateway | `autoheal-api-gateway` | `3000` | `3000` | HTTP | Microservice router & /metrics |
| Web Service | `autoheal-web-service` | `8080` | `8080` | HTTP | Spring Boot backend & actuator |
| AI Service | `autoheal-ai-service` | `8000` | `8000` | HTTP | FastAPI AI diagnostics & /metrics |
| PostgreSQL | `autoheal-postgres` | `5432` | `5432` | TCP | Relational database |
| Tempo | `autoheal-tempo` | `3200`, `4317` | `3200` | HTTP/gRPC | TraceQL API & internal OTLP ingest |
| OTel Collector | `autoheal-otel-collector` | `4317`, `4318`, `8888`, `13133` | `4317`, `4318`, `8888`, `13133` | gRPC/HTTP | OTLP receivers, metrics, healthcheck |
| Prometheus | `autoheal-prometheus` | `9090` | `9090` | HTTP | Scrapes, PromQL, Alerting rules |
| Grafana | `autoheal-grafana` | `3000` | **`3001`** | HTTP | SRE Dashboards (mapped to 3001 to prevent clash with Gateway) |

---

## 5. Reliability, Buffer Protection & Retention

1. **Telemetry Overload Safeguard**:
   The OpenTelemetry Collector is configured with a strict `memory_limiter`:
   - `check_interval`: `1s`
   - `limit_percentage`: `75%`
   - `spike_limit_percentage`: `20%`
   If telemetry bursts exceed safe operating memory, spans are gently dropped rather than risking an out-of-memory container crash.

2. **Network Batching**:
   The `batch` processor aggregates spans into chunks of up to 256 spans or flushes every 1 second, minimizing socket churning and TCP overhead.

3. **Prometheus Retention**:
   Configured with `--storage.tsdb.retention.time=15d` and persistent volume `prometheus_data`, ensuring metrics survive restart events and container rebuilds.

4. **Tempo Storage**:
   Configured with 24-hour local block compaction (`block_retention: 24h`) backed by persistent volume `tempo_data`.
