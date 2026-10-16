# AutoHeal AI — Operations & Reliability Runbook
**Phase 2: Cluster Management, Deployment, and Disaster Recovery**  
**Document Version:** 1.0.0  

---

## 1. Quick Start & Bootstrap

### 1.1 Prerequisites
- Docker Engine 24.0+ (or Docker Desktop 4.25+)
- Docker Compose v2.20+
- Host ports available: `80`, `3000`, `8000`, `8080`, `5432`

### 1.2 Initial Deployment
```bash
# 1. Clone repository and navigate to AutoHealAI root
cd c:/WT_EDI/AutoHeal-AI/AutoHealAI

# 2. Copy environment template
cp .env.example .env

# 3. Build and launch all 6 services in background
docker compose up -d --build

# 4. Verify cluster health status
docker compose ps
```

All continuous services (`frontend`, `api-gateway`, `web-service`, `ai-service`, `postgres`) must show `(healthy)`. `autoheal-flyway` will display `Exited (0)`.

---

## 2. Cluster Health Inspection & Endpoints

| Component | Health URL | Expected Response |
|---|---|---|
| **Frontend UI** | `http://localhost/` | Status code `200` (React dashboard rendered) |
| **Frontend Nginx Probe** | `http://localhost/nginx-health` | `{"service":"frontend-nginx","status":"UP"}` |
| **Gateway Health** | `http://localhost:3000/health` | `{"service":"api-gateway","status":"UP"}` |
| **Gateway Web Proxy** | `http://localhost:3000/api/web/health` | `{"service":"web-service","status":"UP"}` |
| **Gateway AI Proxy** | `http://localhost:3000/api/ai/health` | `{"service":"ai-service","status":"UP"}` |
| **Web Service Direct** | `http://localhost:8080/health` | `{"service":"web-service","status":"UP"}` |
| **AI Service Direct** | `http://localhost:8000/health` | `{"service":"ai-service","status":"UP"}` |

### Quick Probe Command (PowerShell)
```powershell
@(
  "http://localhost/nginx-health",
  "http://localhost:3000/health",
  "http://localhost:3000/api/web/health",
  "http://localhost:3000/api/ai/health"
) | ForEach-Object { "$_ -> " + (Invoke-RestMethod $_ | ConvertTo-Json -Compress) }
```

---

## 3. Routine Operations

### 3.1 Viewing Service Logs
```bash
# Stream all logs
docker compose logs -f

# Stream specific service logs
docker compose logs -f api-gateway
docker compose logs -f web-service
docker compose logs -f ai-service
docker compose logs -f postgres
```

### 3.2 Database Shell & Inspection
```bash
# Open interactive psql shell
docker exec -it autoheal-postgres psql -U autoheal_user -d autoheal

# Query registered services directly
docker exec autoheal-postgres psql -U autoheal_user -d autoheal -c "SELECT * FROM services;"

# Check migration history
docker exec autoheal-postgres psql -U autoheal_user -d autoheal -c "SELECT installed_rank, version, description, success FROM flyway_schema_history;"
```

### 3.3 Adding a New Database Migration
1. Create a new SQL file in `database/migrations/` following naming convention `V<N>__<description>.sql` (e.g., `V2__add_telemetry_metrics.sql`).
2. Run migration:
   ```bash
   docker compose run --rm flyway
   ```
3. Verify status:
   ```bash
   docker exec autoheal-postgres psql -U autoheal_user -d autoheal -c "SELECT version, description, success FROM flyway_schema_history;"
   ```

### 3.4 Rebuilding an Individual Microservice
When modifying code in one service (e.g., `ai-service`), rebuild and redeploy only that service without affecting others:
```bash
docker compose up -d --build ai-service
```

### 3.5 Graceful Shutdown & Cleanup
```bash
# Stop containers preserving data volumes
docker compose down

# Stop containers and PURGE data volumes (WARNING: deletes all database records)
docker compose down -v
```

---

## 4. Troubleshooting & Disaster Recovery

### Issue 1: Port Already in Use (e.g. `Bind for 0.0.0.0:8000 failed`)
- **Diagnosis**: A local process (such as a background development server from Phase 1) is already bound to the port.
- **Remediation**:
  ```powershell
  # Identify PID listening on port 8000
  Get-NetTCPConnection -LocalPort 8000 | Select-Object LocalPort, OwningProcess
  # Stop the process
  Stop-Process -Id <PID> -Force
  ```

### Issue 2: Service Reports 503 "Service Unavailable"
- **Diagnosis**: One downstream service failed or crashed. Check which service is down:
  ```bash
  docker compose ps
  ```
- **Remediation**:
  Check specific container logs:
  ```bash
  docker compose logs <failed-service>
  ```
  Restart failed container:
  ```bash
  docker compose restart <failed-service>
  ```

### Issue 3: Database Authentication Failure
- **Diagnosis**: Password mismatch between `.env` and initialized PostgreSQL data directory.
- **Remediation**:
  PostgreSQL only initializes credentials on first volume creation. If passwords change in `.env`, the volume must be reinitialized:
  ```bash
  docker compose down -v
  docker compose up -d
  ```
