import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

# ==============================================================================
# OpenTelemetry Distributed Tracing Initialization
# ==============================================================================
service_name = os.getenv("OTEL_SERVICE_NAME", "ai-service")
otlp_endpoint = os.getenv(
    "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
    os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4318/v1/traces"),
)

resource = Resource.create({"service.name": service_name})
tracer_provider = TracerProvider(resource=resource)
span_processor = BatchSpanProcessor(OTLPSpanExporter(endpoint=otlp_endpoint))
tracer_provider.add_span_processor(span_processor)
trace.set_tracer_provider(tracer_provider)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # Flush and clean up tracer provider on service termination
    tracer_provider.shutdown()


app = FastAPI(
    title="AutoHeal AI Service",
    description="AI-based fault diagnosis and recovery service",
    version="1.0.0",
    lifespan=lifespan,
)

# Instrument FastAPI with OpenTelemetry for distributed trace propagation.
# W3C traceparent headers are automatically extracted from incoming Gateway requests.
# The /metrics endpoint is excluded from trace generation to prevent scraping telemetry noise.
FastAPIInstrumentor.instrument_app(
    app,
    tracer_provider=tracer_provider,
    excluded_urls="metrics",
)

# ==============================================================================
# Prometheus Metrics Instrumentation
# ==============================================================================
# Automatically instruments all FastAPI routes with:
#   - http_requests_total (counter) — by method, handler, status
#   - http_request_duration_seconds (histogram) — request latency distribution
#   - Python process metrics (CPU, memory, open file descriptors)
Instrumentator(
    should_group_status_codes=False,
    should_ignore_untemplated=True,
    excluded_handlers=["/metrics"],
).instrument(app).expose(app, endpoint="/metrics")


@app.get("/health")
def health():
    return {
        "service": "ai-service",
        "status": "UP",
    }
