# AutoHeal AI
**Autonomous Web Application Recovery System Using AI-Based Fault Diagnosis**

AutoHeal AI is an autonomous self-healing microservice platform designed to monitor distributed web applications, detect anomalous fault events, diagnose root causes using AI, and execute deterministic recovery workflows.

---

## Architecture Overview (Phase 3)

```
[Browser / Client] ──► Frontend (Nginx :80) ──► API Gateway (Node.js :3000)
                                                    │
                                                    ├──► Spring Boot Web Service (:8080) ──► PostgreSQL (:5432)
                                                    └──► FastAPI AI Diagnostic (:8000)

Telemetry Pipeline:
[App Services] ──(OTLP HTTP :4318)──► OTel Collector ──(OTLP gRPC)──► Tempo (:3200)
Prometheus (:9090) ──(Pull Scrape :5s)──► [api-gateway, web-service, ai-service, otel-collector]
Grafana (:3001) ──(Queries)──► [Prometheus, Tempo]
```

The system is fully containerized and orchestrated using Docker Compose with automated PostgreSQL schema migrations (Flyway) and an end-to-end observability stack (OpenTelemetry, Prometheus, Tempo, Grafana).

### Core Services

| Component | Technology | Container Name | Port | Description |
|---|---|---|---|---|
| **Frontend** | React, Vite, Nginx 1.27 Alpine | `autoheal-frontend` | `80` | Real-time monitoring dashboard and reverse proxy |
| **API Gateway** | Express 5, Node.js 20, OpenTelemetry SDK | `autoheal-api-gateway` | `3000` | Microservice router, `/metrics`, and trace propagation |
| **Web Service** | Spring Boot 4, Temurin JRE 21 Alpine | `autoheal-web-service` | `8080` | Managed application backend with Actuator Prometheus metrics |
| **AI Service** | FastAPI, Python 3.11 Slim | `autoheal-ai-service` | `8000` | Fault diagnosis, recovery recommendation engine, `/metrics` |
| **Database** | PostgreSQL 16 Alpine | `autoheal-postgres` | `5432` | Relational store for health checks, faults, and audit logs |
| **Migrations** | Flyway 10 Alpine | `autoheal-flyway` | — | Version-controlled automated schema migrations |
| **Distributed Tracing** | Grafana Tempo 2.6.1 | `autoheal-tempo` | `3200` | High-efficiency TraceQL distributed trace storage |
| **Telemetry Collector** | OpenTelemetry Collector Contrib 0.111.0 | `autoheal-otel-collector` | `4317`, `4318`, `8888` | Pipeline buffering, batching, and routing |
| **Metrics Engine** | Prometheus 2.54.1 | `autoheal-prometheus` | `9090` | Timeseries metrics scraping, PromQL, alerting rules |
| **SRE Dashboards** | Grafana 11.3.0 | `autoheal-grafana` | `3001` | Unified dashboards (System Overview, Service Deep Dive) |

---

## Quick Start (Docker Compose)

### 1. Prerequisites
- Docker Engine 24.0+ / Docker Desktop 4.25+
- Docker Compose v2.20+

### 2. Configure Environment
```bash
# Copy template into local environment file
cp .env.example .env
```

### 3. Build & Run Cluster
```bash
docker compose up -d --build
```

### 4. Verify Health Status
```bash
docker compose ps
```
All continuous services (`frontend`, `api-gateway`, `web-service`, `ai-service`, `postgres`, `prometheus`, `grafana`) will report `(healthy)`.

### 5. Access the Application & Observability Dashboards
- **Dashboard UI**: [http://localhost](http://localhost)
- **Grafana SRE Dashboards**: [http://localhost:3001](http://localhost:3001) (`admin` / `autoheal_grafana_2026`)
- **Prometheus UI**: [http://localhost:9090](http://localhost:9090)
- **Tempo Trace Search**: [http://localhost:3200](http://localhost:3200)
- **API Gateway Health & Metrics**: [http://localhost:3000/health](http://localhost:3000/health) \| [http://localhost:3000/metrics](http://localhost:3000/metrics)
- **Web Service Health & Metrics**: [http://localhost:8080/health](http://localhost:8080/health) \| [http://localhost:8080/actuator/prometheus](http://localhost:8080/actuator/prometheus)
- **AI Service Health & Metrics**: [http://localhost:8000/health](http://localhost:8000/health) \| [http://localhost:8000/metrics](http://localhost:8000/metrics)

---

## Local Development (Without Containers)

Local development remains supported. Each service defaults to `localhost` when environment variables are omitted:
```bash
# 1. API Gateway
cd api-gateway && npm install && npm start

# 2. AI Service
cd ai-service && pip install -r requirements.txt && uvicorn main:app --reload --port 8000

# 3. Web Service
cd services/web-service && ./mvnw spring-boot:run

# 4. Frontend (Vite with automatic /api proxy)
cd frontend && npm install && npm run dev
```

---

## Documentation

Detailed architectural and operational documentation is located in `docs/`:
- [Phase 3 Observability Architecture & Design Specification](docs/phase-3-observability-design.md)
- [Phase 3 Telemetry & Metrics Catalogue](docs/telemetry-catalogue.md)
- [Phase 3 Observability Operations Runbook](docs/phase-3-observability-runbook.md)
- [Phase 3 Completion Report](docs/phase-3-completion-report.md)
- [Phase 2 Infrastructure Architecture & Design Specification](docs/phase-2-infrastructure-design.md)
- [Phase 2 Database Design & Schema Specification](docs/database-design.md)
- [Phase 2 Operations & Reliability Runbook](docs/phase-2-runbook.md)
- [Phase 2 Completion Report](docs/phase-2-completion-report.md)

