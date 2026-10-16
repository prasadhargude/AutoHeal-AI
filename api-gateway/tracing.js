'use strict';

const process = require('process');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME } = require('@opentelemetry/semantic-conventions');

// Configurable OTLP endpoint from environment, defaulting to otel-collector HTTP endpoint
const otlpUrl = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 
                process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 
                'http://otel-collector:4318/v1/traces';

const serviceName = process.env.OTEL_SERVICE_NAME || 'api-gateway';

// Initialize the OTLP HTTP trace exporter
const traceExporter = new OTLPTraceExporter({
    url: otlpUrl,
});

// Configure the NodeSDK with automatic HTTP, Express, and fetch instrumentation
const sdk = new NodeSDK({
    resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
    }),
    traceExporter,
    instrumentations: [
        getNodeAutoInstrumentations({
            // Disable noisy filesystem instrumentation to preserve trace clarity
            '@opentelemetry/instrumentation-fs': {
                enabled: false,
            },
        }),
    ],
});

// Start tracing SDK before application bootstrap
sdk.start();

// Handle graceful shutdown on container termination
process.on('SIGTERM', () => {
    sdk.shutdown()
        .then(() => console.log('OpenTelemetry tracing terminated'))
        .catch((error) => console.error('Error terminating OpenTelemetry tracing', error))
        .finally(() => process.exit(0));
});

module.exports = sdk;
