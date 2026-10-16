# AutoHeal AI
**Autonomous Web Application Recovery System Using AI-Based Fault Diagnosis**

[![Architecture: Microservices](https://img.shields.io/badge/Architecture-Microservices-blue.svg)](#architecture-overview)
[![Docker: Compose v2](https://img.shields.io/badge/Docker-Compose%20v2-2496ED.svg?logo=docker&logoColor=white)](#quick-start-docker-compose-recommended)
[![Telemetry: OpenTelemetry](https://img.shields.io/badge/Telemetry-OpenTelemetry-F5A800.svg?logo=opentelemetry&logoColor=white)](#observability--telemetry-stack)
[![Metrics: Prometheus](https://img.shields.io/badge/Metrics-Prometheus-E6522C.svg?logo=prometheus&logoColor=white)](#observability--telemetry-stack)
[![Tracing: Tempo](https://img.shields.io/badge/Tracing-Grafana%20Tempo-F46800.svg?logo=grafana&logoColor=white)](#observability--telemetry-stack)
[![Database: PostgreSQL 16](https://img.shields.io/badge/Database-PostgreSQL%2016-336791.svg?logo=postgresql&logoColor=white)](#core-services)

---

## 1. Project Description & Mission

**AutoHeal AI** is an enterprise-grade autonomous self-healing microservice platform. Modern distributed systems frequently experience transient errors, cascading downstream timeouts, database pool exhaustion, memory leaks, and CPU throttling. Traditional incident resolution requires human SREs to parse logs, correlate alerts, and manually restart services or execute runbooks—leading to prolonged Mean Time To Recovery (MTTR) and service downtime.

AutoHeal AI eliminates human intervention by implementing a continuous **Detect ➔ Diagnose ➔ Remediate ➔ Audit** loop:
1. **High-Frequency Telemetry**: Sub-second application metrics (Prometheus) and distributed traces (OpenTelemetry / Tempo) continuously monitor system behavior.
2. **AI-Driven Root Cause Diagnosis**: A dedicated AI diagnostic microservice inspects anomalous metric distributions and trace waterfall graphs to classify faults (e.g., deadlock, memory leak, network partition, dependency outage).
3. **Autonomous Self-Healing Execution**: An intelligent recovery controller selects and triggers deterministic remediation workflows (e.g., circuit breaker isolation, container restarts, resource reallocation, traffic redirection) without human intervention.
4. **Relational Audit Trail**: Every health check, fault detection, AI diagnosis, and recovery action is permanently recorded in PostgreSQL with version-controlled Flyway migrations.

---

## 2. Multi-Phase Roadmap

| Phase | Title | Focus & Scope | Status |
| :---: | :--- | :--- | :---: |
| **Phase 1** | **Application Foundation** | Multi-runtime baseline: Express Gateway, Spring Boot Web Service, FastAPI AI Service, React UI. | ✅ Completed |
| **Phase 2** | **Containerization & DB** | Docker multi-stage builds, Docker Compose orchestration, PostgreSQL 16, Flyway schema migrations, fault isolation. | ✅ Completed |
| **Phase 3** | **Industry-Grade Observability** | OpenTelemetry SDKs, W3C traceparent propagation, OTel Collector, Grafana Tempo, Prometheus scraping & alerts, Grafana SRE dashboards. | ✅ Completed |
| **Phase 4** | **AI Diagnosis & Self-Healing** | Chaos fault injection (CPU spike, memory leak, pool exhaustion), ML anomaly detection, and autonomous closed-loop recovery. | 🚀 Next Up |

---

## 3. Architecture Overview

```
                                [ Client / Web Browser ]
                                           │
                                           ▼ HTTP :80
                                ┌──────────────────────┐
                                │   autoheal-frontend  │
                                │ (React / Nginx 1.27) │
                                └──────────┬───────────┘
                                           │ /api/*
                                           ▼ HTTP :3000
       ┌────────────────────────────────────────────────────────────────────────┐
       │                          autoheal-api-gateway                          │
       │        (Express 5 / Node.js 20 / prom-client / OpenTelemetry SDK)      │
       └───────────────┬────────────────────────────────────────┬───────────────┘
                       │ W3C traceparent (:8080)                │ W3C traceparent (:8000)
                       ▼                                        ▼
       ┌───────────────────────────────┐        ┌───────────────────────────────┐
       │      autoheal-web-service     │        │      autoheal-ai-service      │
       │   (Spring Boot 4 / Java 21)   │        │     (FastAPI / Python 3.11)   │
       │    Micrometer Tracing Bridge  │        │   FastAPIInstrumentor + OTLP  │
       └───────────────┬───────────────┘        └───────────────┬───────────────┘
                       │ SQL (:5432)                            │
                       ▼                                        │
       ┌───────────────────────────────┐                        │
       │       autoheal-postgres       │                        │
       │        (PostgreSQL 16)        │                        │
       └───────────────────────────────┘                        │
                                                                │
 =========================== TELEMETRY INGESTION PIPELINE =======│========================
                                                                │
           [web-service]               [api-gateway]            [ai-service]
                 │ (OTLP HTTP :4318)         │ (OTLP HTTP :4318)      │ (OTLP HTTP :4318)
                 └───────────────────┬───────┴────────────────────────┘
                                     ▼
                      ┌───────────────────────────────┐
                      │    autoheal-otel-collector    │
                      │   (OTel Collector Contrib)    │
                      │   - memory_limiter (75%/20%)  │
                      │   - batch (256 spans / 1s)    │
                      └──────────────┬────────────────┘
                                     │ OTLP gRPC (:4317)
                                     ▼
                      ┌───────────────────────────────┐
                      │        autoheal-tempo         │
                      │        (Grafana Tempo)        │
                      │   - Local block trace storage │
                      │   - TraceQL query API (:3200) │
                      └──────────────▲────────────────┘
                                     │
 =========================== METRICS SCRAPE & QUERY PIPELINE ====│========================
                                     │
       ┌─────────────────────────────┴──────────────────────────────────────────┐
       │                          autoheal-prometheus                           │
       │   Scrapes every 5s:                                                    │
       │    - api-gateway:3000/metrics                                          │
       │    - web-service:8080/actuator/prometheus                              │
       │    - ai-service:8000/metrics                                           │
       │    - otel-collector:8888/metrics                                       │
       │    - localhost:9090/metrics                                            │
       │   Alert Rules: ServiceDown, HighHttpErrorRate, HighHttpLatency         │
       └─────────────────────────────┬──────────────────────────────────────────┘
                                     │ PromQL / Target queries
                                     ▼
       ┌────────────────────────────────────────────────────────────────────────┐
       │                            autoheal-grafana                            │
       │   - Datasources: Prometheus (:9090), Tempo (:3200)                     │
       │   - Dashboards: System Overview & Service Deep Dive                    │
       │   - User: admin / autoheal_grafana_2026 (Mapped to Host Port :3001)    │
       └────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Core Services & Component Catalogue

| Component | Technology Stack | Container Name | Host Port | Description |
|---|---|---|---|---|
| **Frontend** | React 19, Vite, Nginx 1.27 Alpine | `autoheal-frontend` | `80` | Real-time monitoring dashboard and reverse proxy. |
| **API Gateway** | Express 5, Node.js 20, OpenTelemetry SDK | `autoheal-api-gateway` | `3000` | Microservice router with downstream timeout protection and `/metrics`. |
| **Web Service** | Spring Boot 4.1.1, Temurin JRE 21 Alpine | `autoheal-web-service` | `8080` | Managed application backend with Micrometer Actuator Prometheus metrics. |
| **AI Service** | FastAPI 0.143, Python 3.11 Slim | `autoheal-ai-service` | `8000` | Fault diagnosis and recovery recommendation engine emitting `/metrics`. |
| **Database** | PostgreSQL 16 Alpine | `autoheal-postgres` | `5432` | Relational store for health checks, faults, diagnoses, and recovery audit logs. |
| **Migrations** | Flyway 10 Alpine | `autoheal-flyway` | — | Version-controlled automated relational schema migrations. |
| **Distributed Tracing** | Grafana Tempo 2.6.1 | `autoheal-tempo` | `3200` | High-efficiency TraceQL distributed trace storage. |
| **Telemetry Collector**| OpenTelemetry Collector Contrib 0.111.0| `autoheal-otel-collector`| `4317`, `4318`, `8888` | Pipeline buffering (`memory_limiter`), trace batching, and routing. |
| **Metrics Engine** | Prometheus 2.54.1 | `autoheal-prometheus` | `9090` | Timeseries metric scraping (5s interval), PromQL, and alerting rules. |
| **SRE Dashboards** | Grafana 11.3.0 | `autoheal-grafana` | `3001` | Single-pane-of-glass dashboards with cross-linked metrics and traces. |

---

## 5. Step-by-Step Setup Guide (Docker Compose — Recommended)

This is the standard and recommended way to run the entire AutoHeal AI ecosystem. Zero dependencies beyond Docker Desktop are required.

### 5.1 Prerequisites
- **Operating System**: Windows 10/11 (with WSL2 backend), macOS, or Linux.
- **Docker Desktop**: Version 4.25+ or Docker Engine 24.0+.
- **Docker Compose**: Version v2.20+ (included with Docker Desktop).
- **RAM**: Minimum 8 GB allocated to Docker Desktop (12 GB recommended).

### 5.2 Clone Repository
```bash
git clone https://github.com/prasadhargude/AutoHeal-AI.git
cd AutoHeal-AI
```

### 5.3 Configure Environment Variables
Copy the environment template into your local `.env` file:
```bash
# On Linux / macOS / Git Bash:
cp .env.example .env

# On Windows PowerShell:
Copy-Item .env.example .env
```

The defaults in `.env.example` work out-of-the-box:
```ini
# Application Ports
FRONTEND_PORT=80
GATEWAY_PORT=3000
WEB_SERVICE_PORT=8080
AI_SERVICE_PORT=8000
DB_PORT=5432

# Observability Ports
TEMPO_PORT=3200
OTEL_COLLECTOR_GRPC_PORT=4317
OTEL_COLLECTOR_HTTP_PORT=4318
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001

# Grafana Credentials
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=autoheal_grafana_2026
```

### 5.4 Build & Start the Cluster
Build and start all 10 containers in detached mode:
```bash
docker compose up -d --build
```

*Note: The initial build compiles Java with Maven, builds Node.js Vite assets, downloads Python wheels, and pulls container images. Subsequent starts take less than 5 seconds.*

### 5.5 Verify Container Health Status
Check the status of all running containers:
```bash
docker compose ps
```

Expected output:
```text
NAME                     IMAGE                                         STATUS                    PORTS
autoheal-frontend        autoheal-frontend:latest                      Up (healthy)              0.0.0.0:80->80/tcp
autoheal-api-gateway     autoheal-api-gateway:latest                   Up (healthy)              0.0.0.0:3000->3000/tcp
autoheal-web-service     autoheal-web-service:latest                   Up (healthy)              0.0.0.0:8080->8080/tcp
autoheal-ai-service      autoheal-ai-service:latest                    Up (healthy)              0.0.0.0:8000->8000/tcp
autoheal-postgres        postgres:16-alpine                            Up (healthy)              0.0.0.0:5432->5432/tcp
autoheal-flyway          flyway/flyway:10-alpine                       Exited (0)                
autoheal-tempo           grafana/tempo:2.6.1                           Up                        0.0.0.0:3200->3200/tcp
autoheal-otel-collector  otel/opentelemetry-collector-contrib:0.111.0  Up                        0.0.0.0:4317-4318->4317-4318/tcp
autoheal-prometheus      prom/prometheus:v2.54.1                       Up (healthy)              0.0.0.0:9090->9090/tcp
autoheal-grafana         grafana/grafana:11.3.0                        Up (healthy)              0.0.0.0:3001->3000/tcp
```

### 5.6 Access Applications & Dashboards

| Service / Interface | URL | Credentials / Notes |
|---|---|---|
| **Frontend UI** | [http://localhost](http://localhost) | React dashboard showing real-time service health |
| **Grafana Dashboards** | [http://localhost:3001](http://localhost:3001) | **Username:** `admin`<br>**Password:** `autoheal_grafana_2026` |
| **Prometheus UI & Alerts** | [http://localhost:9090](http://localhost:9090) | Targets overview, PromQL queries, and Alert rules |
| **Tempo Trace Search** | [http://localhost:3200](http://localhost:3200) | Distributed trace backend |
| **API Gateway Health** | [http://localhost:3000/health](http://localhost:3000/health) | Gateway liveness probe |
| **API Gateway Metrics** | [http://localhost:3000/metrics](http://localhost:3000/metrics) | Express `prom-client` exposition |
| **Web Service Actuator** | [http://localhost:8080/actuator/prometheus](http://localhost:8080/actuator/prometheus) | Micrometer JVM & HTTP histograms |
| **AI Service Metrics** | [http://localhost:8000/metrics](http://localhost:8000/metrics) | FastAPI request distribution histograms |

---

## 6. Local Development Setup (Without Containers)

If you wish to develop a specific microservice locally on the host machine without Docker, each service supports direct local execution.

### Prerequisites
- Node.js 20+ & npm
- JDK 21 (Temurin / OpenJDK) & Maven
- Python 3.11+ & pip
- PostgreSQL 16 running locally on port `5432`

### Service-by-Service Execution

1. **Start PostgreSQL Database**:
   Ensure a local PostgreSQL instance is running on port 5432 with database `autoheal`, user `autoheal_user`, and password `autoheal_dev_pass_2026`.
   Apply schema migrations:
   ```bash
   # From project root:
   cd database/migrations
   psql -U autoheal_user -d autoheal -f V1__initial_schema.sql
   ```

2. **Terminal 1 — API Gateway (Node.js)**:
   ```bash
   cd api-gateway
   npm install
   npm start
   # Server runs on http://localhost:3000
   ```

3. **Terminal 2 — AI Service (FastAPI)**:
   ```bash
   cd ai-service
   python -m venv .venv
   # Windows: .venv\Scripts\activate | macOS/Linux: source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   # Service runs on http://localhost:8000
   ```

4. **Terminal 3 — Web Service (Spring Boot)**:
   ```bash
   cd services/web-service
   # Windows: .\mvnw.cmd spring-boot:run | macOS/Linux: ./mvnw spring-boot:run
   # Service runs on http://localhost:8080
   ```

5. **Terminal 4 — Frontend (React / Vite)**:
   ```bash
   cd frontend
   npm install
   npm run dev
   # Development server runs on http://localhost:5173 with automatic /api proxy
   ```

---

## 7. Verification & Chaos Testing

You can empirically verify AutoHeal AI's resilience and observability pipeline using the following steps:

### 1. Verify Scrape Targets Health
```bash
curl -s http://localhost:9090/api/v1/targets | jq .data.activeTargets[].health
# Expected: All 5 targets return "up"
```

### 2. Generate Trace Traffic
Send traffic through the API Gateway to downstream services:
```bash
# Windows PowerShell:
1..10 | ForEach-Object { 
    curl.exe -s http://localhost:3000/api/web/health | Out-Null
    curl.exe -s http://localhost:3000/api/ai/health | Out-Null 
}

# Linux / macOS:
for i in {1..10}; do
    curl -s http://localhost:3000/api/web/health > /dev/null
    curl -s http://localhost:3000/api/ai/health > /dev/null
done
```

### 3. Verify Distributed Traces in Tempo
Query Tempo for recent traces:
```bash
curl -s http://localhost:3200/api/search | jq .traces[0]
```

### 4. Execute Controlled Failure Injection
Simulate a downstream dependency outage by stopping the web service:
```bash
docker compose stop web-service
```
1. Request web service health via Gateway:
   ```bash
   curl -i http://localhost:3000/api/web/health
   # Returns: HTTP 503 Service Unavailable with fallback JSON payload
   ```
2. Verify downstream error metric in Prometheus:
   ```bash
   curl -s "http://localhost:9090/api/v1/query?query=gateway_downstream_duration_seconds_count{status_code=\"503\"}"
   ```
3. Observe `ServiceDown` alert firing at [http://localhost:9090/alerts](http://localhost:9090/alerts).
4. Recover the service:
   ```bash
   docker compose start web-service
   ```
5. Confirm immediate return to `HTTP 200 OK` and automated alert resolution in Prometheus.

---

## 8. Repository Structure

```
AutoHeal-AI/
├── .env.example                               # Canonical environment variables template
├── docker-compose.yml                         # 10-service production orchestration
├── README.md                                  # Complete project & setup documentation
├── phase-2-progress.md                        # Phase 2 status & milestone report
├── phase-3-progress.md                        # Phase 3 status & milestone report
│
├── api-gateway/                               # Node.js 20 / Express 5 API Gateway
│   ├── Dockerfile                             # Multi-stage production container
│   ├── server.js                              # Routing, timeouts, prom-client metrics
│   ├── tracing.js                             # OpenTelemetry NodeSDK preloader
│   └── package.json
│
├── services/web-service/                      # Spring Boot 4 / Java 21 Web Service
│   ├── Dockerfile                             # Multi-stage Maven ➔ Temurin JRE 21
│   ├── pom.xml                                # Actuator, Micrometer Prometheus & OTel
│   └── src/main/resources/
│       └── application.properties             # Percentile histograms & OTLP exporter
│
├── ai-service/                                # FastAPI / Python 3.11 Diagnostic Engine
│   ├── Dockerfile                             # Python 3.11-slim non-root container
│   ├── main.py                                # OTLP trace exporter & Prometheus instrumentor
│   └── requirements.txt                       # Locked dependencies
│
├── frontend/                                  # React 19 / Vite Frontend
│   ├── Dockerfile                             # Multi-stage Node 20 ➔ Nginx 1.27 Alpine
│   ├── nginx.conf                             # Production reverse proxy for /api/
│   └── src/App.jsx                            # Live health monitoring UI
│
├── database/                                  # Database migrations & schemas
│   └── migrations/
│       └── V1__initial_schema.sql             # 5 core operational tables, triggers, indices
│
├── monitoring/                                # Observability infrastructure configs
│   ├── otel-collector/
│   │   └── otel-collector-config.yml          # OTLP receivers, memory_limiter, batching
│   ├── tempo/
│   │   └── tempo.yml                          # TraceQL engine & local block storage
│   ├── prometheus/
│   │   ├── prometheus.yml                     # 5s scrape targets
│   │   └── alert_rules.yml                    # ServiceDown, HighErrorRate, HighLatency
│   └── grafana/
│       ├── provisioning/
│       │   ├── datasources/datasources.yml    # Prometheus & Tempo cross-linked
│       │   └── dashboards/dashboards.yml      # Automated dashboard provider
│       └── dashboards/
│           ├── autoheal-system-overview.json  # Golden signals SRE dashboard
│           └── service-deep-dive.json         # Per-service CPU/memory/error deep dive
│
└── docs/                                      # Comprehensive architectural documentation
    ├── phase-3-observability-design.md        # Telemetry architecture & technology selection
    ├── telemetry-catalogue.md                 # Complete metrics & trace span dictionary
    ├── phase-3-observability-runbook.md       # SRE operations & incident runbook
    ├── phase-3-completion-report.md           # Empirical verification sign-off report
    ├── phase-2-infrastructure-design.md       # Containerization architecture
    ├── database-design.md                     # PostgreSQL ERD & schema dictionary
    ├── phase-2-runbook.md                     # Cluster operations runbook
    └── phase-2-completion-report.md           # Phase 2 sign-off report
```

---

## 9. Comprehensive Documentation Suite

For deeper architectural, operational, and database specifications, refer to the documentation in [`docs/`](docs/):

- **Phase 3 Observability Suite**:
  - [Phase 3 Observability Architecture & Design Specification](docs/phase-3-observability-design.md)
  - [Phase 3 Telemetry & Metrics Catalogue](docs/telemetry-catalogue.md)
  - [Phase 3 Observability Operations Runbook](docs/phase-3-observability-runbook.md)
  - [Phase 3 Completion Report](docs/phase-3-completion-report.md)
- **Phase 2 Infrastructure & Database Suite**:
  - [Phase 2 Infrastructure Architecture & Design Specification](docs/phase-2-infrastructure-design.md)
  - [Phase 2 Database Design & Schema Specification](docs/database-design.md)
  - [Phase 2 Operations & Reliability Runbook](docs/phase-2-runbook.md)
  - [Phase 2 Completion Report](docs/phase-2-completion-report.md)

---

## 10. License & Contributing

AutoHeal AI is open-source research and engineering software licensed under the **Apache 2.0 License**. Pull requests and issue submissions are welcome.
