import { ClientRequest } from 'http';
import type { Tracer } from '@opentelemetry/api';
import * as api from '@opentelemetry/api';
import { SpanStatusCode } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { BunyanInstrumentation } from '@opentelemetry/instrumentation-bunyan';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { Resource } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { pkg } from '../expose.cjs';
import {
  isTraceDebuggingEnabled,
  isTraceSendingEnabled,
  isTracingEnabled,
} from './utils';

let traceProvider: NodeTracerProvider;

init();

export function init(): void {
  traceProvider = new NodeTracerProvider({
    resource: new Resource({
      // https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/resource/semantic_conventions/README.md#semantic-attributes-with-sdk-provided-default-value
      [SemanticResourceAttributes.SERVICE_NAME]: 'renovate',
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'renovatebot.com',
      [SemanticResourceAttributes.SERVICE_VERSION]: pkg.version,
    }),
  });
  api.trace.setGlobalTracerProvider(traceProvider);

  // add processors
  if (isTraceDebuggingEnabled()) {
    traceProvider.addSpanProcessor(
      new SimpleSpanProcessor(new ConsoleSpanExporter())
    );
  }

  // OTEL specification environment variable
  if (isTraceSendingEnabled()) {
    const exporter = new OTLPTraceExporter();
    traceProvider.addSpanProcessor(new BatchSpanProcessor(exporter));
  }

  if (isTracingEnabled()) {
    const contextManager = new AsyncLocalStorageContextManager();
    api.context.setGlobalContextManager(contextManager);
    traceProvider.register({
      contextManager,
    });
  }

  registerInstrumentations({
    instrumentations: [
      new HttpInstrumentation({
        applyCustomAttributesOnSpan: /* istanbul ignore next */ (
          span,
          request,
          response
        ) => {
          // ignore 404 errors when the branch protection of Github could not be found. This is expected if no rules are configured
          if (
            !(request instanceof ClientRequest) ||
            (request.host === `api.github.com` &&
              request.path.endsWith(`/protection`) &&
              response.statusCode === 404)
          ) {
            span.setStatus({ code: SpanStatusCode.OK });
          }
        },
      }),
      new BunyanInstrumentation(),
    ],
  });
}

export function getTracerProvider(): NodeTracerProvider {
  return traceProvider;
}

export function getTracer(): Tracer {
  return traceProvider.getTracer('renovate');
}
