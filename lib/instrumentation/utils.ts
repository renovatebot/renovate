import is from '@sindresorhus/is';

export function isTracingEnabled(): boolean {
  return isTraceDebuggingEnabled() || isTraceSendingEnabled();
}

export function isTraceDebuggingEnabled(): boolean {
  return !!process.env.RENOVATE_TRACING_CONSOLE_EXPORTER;
}

export function isTraceSendingEnabled(): boolean {
  return !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
}

export function massageThrowable(e: unknown): string | undefined {
  if (is.nullOrUndefined(e)) {
    return undefined;
  }
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}
