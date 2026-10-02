import { isNullOrUndefined } from '@sindresorhus/is';
import { getEnv } from '../util/env.ts';

export type OtlpProtocol = 'grpc' | 'http/json' | 'http/protobuf';

const otlpProtocols: OtlpProtocol[] = ['grpc', 'http/json', 'http/protobuf'];

// https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/configuration/sdk-environment-variables.md#otlp-exporter
// `OTEL_EXPORTER_OTLP_TRACES_PROTOCOL` takes precedence over the general `OTEL_EXPORTER_OTLP_PROTOCOL`.
// Defaults to `http/json`, matching Renovate's historic (pre-multi-protocol) behaviour, rather than the spec's `http/protobuf` default, to avoid a breaking change for existing users who haven't set this variable.
export function getOtlpProtocol(): OtlpProtocol {
  const protocol =
    getEnv().OTEL_EXPORTER_OTLP_TRACES_PROTOCOL ??
    getEnv().OTEL_EXPORTER_OTLP_PROTOCOL;
  return otlpProtocols.includes(protocol as OtlpProtocol)
    ? (protocol as OtlpProtocol)
    : 'http/json';
}

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
