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

export function massageThrowable(e: unknown): string | undefined {
  if (isNullOrUndefined(e)) {
    return undefined;
  }
  if (e instanceof Error) {
    return e.message;
  }
  return String(e); // oxlint-disable-line typescript/no-base-to-string
}
