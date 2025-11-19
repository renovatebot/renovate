import { isNullOrUndefined } from '@sindresorhus/is';
import { getEnv } from '../util/env';

export function isTracingEnabled(): boolean {
  return isTraceDebuggingEnabled() || isTraceSendingEnabled();
}

export function isTraceDebuggingEnabled(): boolean {
  return !!getEnv().RENOVATE_TRACING_CONSOLE_EXPORTER;
}

export function isTraceSendingEnabled(): boolean {
  return !!getEnv().OTEL_EXPORTER_OTLP_ENDPOINT;
}

export function massageThrowable(e: unknown): string | undefined {
  if (isNullOrUndefined(e)) {
    return undefined;
  }
  if (e instanceof Error) {
    return e.message;
  }
  return String(e); // eslint-disable-line @typescript-eslint/no-base-to-string
}
