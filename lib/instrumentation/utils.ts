export function isTracingEnabled(): boolean {
  return isTraceDebuggingEnabled() || isTraceSendingEnabled();
}

export function isTraceDebuggingEnabled(): boolean {
  return !!process.env.RENOVATE_DEBUG_TRACING;
}

export function isTraceSendingEnabled(): boolean {
  return !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
}
