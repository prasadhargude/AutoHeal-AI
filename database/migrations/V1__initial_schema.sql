-- ==============================================================================
-- AutoHeal AI — Initial Database Schema
-- Migration: V1__initial_schema.sql
-- Description: Core tables for microservice tracking, health monitoring,
--              fault events, recovery actions, and audit logging.
-- ==============================================================================

-- Enable pgcrypto for UUID generation if needed (gen_random_uuid is built-in in PG 13+)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Services: Registry of managed services in the AutoHeal cluster
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(64) UNIQUE NOT NULL,
    display_name VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN',
    health_endpoint VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to update updated_at timestamp on services
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_services_updated_at ON services;
CREATE TRIGGER update_services_updated_at
    BEFORE UPDATE ON services
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 2. Health Checks: Historical log of periodic health probes
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_checks (
    id BIGSERIAL PRIMARY KEY,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL,
    response_time_ms INTEGER,
    error_message TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_health_checks_service_checked 
    ON health_checks(service_id, checked_at DESC);

-- ------------------------------------------------------------------------------
-- 3. Fault Events: Incidents detected by health monitors or anomaly detectors
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fault_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    fault_type VARCHAR(64) NOT NULL,
    severity VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
    description TEXT,
    raw_payload JSONB,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fault_events_service_detected 
    ON fault_events(service_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_fault_events_severity 
    ON fault_events(severity);

-- ------------------------------------------------------------------------------
-- 4. Recovery Actions: Remediation steps triggered autonomously or manually
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recovery_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fault_event_id UUID NOT NULL REFERENCES fault_events(id) ON DELETE CASCADE,
    action_type VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    execution_logs TEXT,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_recovery_actions_fault_event 
    ON recovery_actions(fault_event_id);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_status 
    ON recovery_actions(status);

-- ------------------------------------------------------------------------------
-- 5. Audit Logs: Security and operational event trail
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    performed_by VARCHAR(64) NOT NULL DEFAULT 'SYSTEM',
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity 
    ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
    ON audit_logs(created_at DESC);

-- ------------------------------------------------------------------------------
-- Seed Initial Service Records
-- ------------------------------------------------------------------------------
INSERT INTO services (name, display_name, status, health_endpoint)
VALUES
    ('api-gateway', 'API Gateway', 'UP', '/health'),
    ('web-service', 'Spring Boot Web Service', 'UP', '/health'),
    ('ai-service', 'FastAPI AI Diagnostic Service', 'UP', '/health')
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    health_endpoint = EXCLUDED.health_endpoint;
