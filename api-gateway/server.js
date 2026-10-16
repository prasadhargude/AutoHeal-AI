const express = require('express');
const cors = require('cors');
const client = require('prom-client');

const app = express();

// Configuration from environment variables with local-development defaults.
// In Docker Compose these are set to service DNS names (e.g. http://web-service:8080).
// For local development the defaults point to localhost.
const PORT = process.env.GATEWAY_PORT || 3000;
const WEB_SERVICE_URL = process.env.WEB_SERVICE_URL || 'http://localhost:8080';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Timeout for downstream service requests (milliseconds).
const FETCH_TIMEOUT_MS = 5000;

// ==============================================================================
// Prometheus Metrics Setup
// ==============================================================================

// Collect default Node.js process metrics (CPU, memory, event loop lag, GC, etc.)
const register = client.register;
client.collectDefaultMetrics({ register });

// HTTP request duration histogram — measures inbound request latency.
// Buckets chosen to give fine resolution under 100ms (typical health-check range)
// and coarser resolution for slower requests up to 5s.
const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of inbound HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

// HTTP request counter — counts inbound requests by method, route, and status.
const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of inbound HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
});

// Downstream call duration histogram — measures gateway-to-service call latency.
// Critical for diagnosing which downstream service is slow or failing.
const downstreamDuration = new client.Histogram({
    name: 'gateway_downstream_duration_seconds',
    help: 'Duration of downstream service calls from the gateway in seconds',
    labelNames: ['target_service', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

// ==============================================================================
// Middleware
// ==============================================================================

app.use(cors());
app.use(express.json());

// Metrics collection middleware — records duration and count for every request
// except the /metrics endpoint itself (avoids self-referencing measurement).
app.use((req, res, next) => {
    if (req.path === '/metrics') {
        return next();
    }
    const end = httpRequestDuration.startTimer();
    res.on('finish', () => {
        // Use matched route template for bounded cardinality; fall back to
        // 'unmatched' for requests that hit no route (e.g. 404).
        const route = req.route?.path || 'unmatched';
        const labels = {
            method: req.method,
            route: route,
            status_code: res.statusCode,
        };
        end(labels);
        httpRequestsTotal.inc(labels);
    });
    next();
});

// ==============================================================================
// Prometheus Metrics Endpoint
// ==============================================================================

app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (err) {
        res.status(500).end(err.message);
    }
});

// ==============================================================================
// Application Endpoints
// ==============================================================================

app.get('/health', (req, res) => {
    res.json({
        service: 'api-gateway',
        status: 'UP'
    });
});

/**
 * Timed downstream fetch — records call duration and status in Prometheus.
 * If the downstream call fails (timeout, network error), the error is recorded
 * with status_code 503 and the error is re-thrown for the route handler to catch.
 *
 * @param {string} url - Full URL of the downstream service endpoint.
 * @param {string} serviceName - Bounded service label for Prometheus metrics.
 * @returns {Promise<{status: number, data: object}>}
 */
async function fetchDownstream(url, serviceName) {
    const end = downstreamDuration.startTimer();
    try {
        const response = await fetch(url, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        const data = await response.json();
        end({ target_service: serviceName, status_code: response.status });
        return { status: response.status, data };
    } catch (error) {
        end({ target_service: serviceName, status_code: 503 });
        throw error;
    }
}

app.get('/api/web/health', async (req, res) => {
    try {
        const result = await fetchDownstream(`${WEB_SERVICE_URL}/health`, 'web-service');
        res.status(result.status).json(result.data);
    } catch (error) {
        res.status(503).json({
            service: 'web-service',
            status: 'DOWN',
            error: 'Web service unavailable'
        });
    }
});

app.get('/api/ai/health', async (req, res) => {
    try {
        const result = await fetchDownstream(`${AI_SERVICE_URL}/health`, 'ai-service');
        res.status(result.status).json(result.data);
    } catch (error) {
        res.status(503).json({
            service: 'ai-service',
            status: 'DOWN',
            error: 'AI service unavailable'
        });
    }
});

app.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
    console.log(`  Web Service URL: ${WEB_SERVICE_URL}`);
    console.log(`  AI Service URL:  ${AI_SERVICE_URL}`);
});
