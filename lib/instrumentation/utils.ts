import { context, propagation } from '@opentelemetry/api';
import { isNullOrUndefined } from '@sindresorhus/is';
import { getEnv } from '../util/env.ts';

export function isTracingEnabled(): boolean {
  return (
    isTraceDebuggingEnabled() ||
    isTraceSendingEnabled() ||
    isFileExporterEnabled()
  );
}

export function isTraceDebuggingEnabled(): boolean {
  return !!getEnv().RENOVATE_TRACING_CONSOLE_EXPORTER;
}

export function isTraceSendingEnabled(): boolean {
  return !!getEnv().OTEL_EXPORTER_OTLP_ENDPOINT;
}

export function isFileExporterEnabled(): boolean {
  return !!getEnv().RENOVATE_TRACING_FILE_EXPORTER_PATH;
}

export function getFileExporterPath(): string {
  return getEnv().RENOVATE_TRACING_FILE_EXPORTER_PATH!;
}

/**
 * Builds the env vars needed to hand the current trace context to a child
 * process, using the W3C Trace Context format (https://www.w3.org/TR/trace-context/).
 * Tools which have native OpenTelemetry support can pick these up to join the
 * same trace as the `rawExec` span that spawned them.
 */
export function getTraceContextEnv(): NodeJS.ProcessEnv {
  if (!isTracingEnabled()) {
    return {};
  }

  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);

  const env: NodeJS.ProcessEnv = {};
  if (carrier.traceparent) {
    env.TRACEPARENT = carrier.traceparent;
  }
  if (carrier.tracestate) {
    env.TRACESTATE = carrier.tracestate;
  }
  return env;
}

export function massageThrowable(e: unknown): string | undefined {
  if (isNullOrUndefined(e)) {
    return undefined;
  }
  if (e instanceof Error) {
    return e.message;
  }
  return String(e); // oxlint-disable-line typescript/no-base-to-string
}
