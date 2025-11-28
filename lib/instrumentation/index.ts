import { ClientRequest } from 'node:http';
import type { Context, Span, Tracer, TracerProvider } from '@opentelemetry/api';
import * as api from '@opentelemetry/api';
import { ProxyTracerProvider, SpanStatusCode } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import type { Instrumentation } from '@opentelemetry/instrumentation';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { BunyanInstrumentation } from '@opentelemetry/instrumentation-bunyan';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis';
import {
  awsBeanstalkDetector,
  awsEc2Detector,
  awsEcsDetector,
  awsEksDetector,
  awsLambdaDetector,
} from '@opentelemetry/resource-detector-aws';
import {
  azureAppServiceDetector,
  azureFunctionsDetector,
  azureVmDetector,
} from '@opentelemetry/resource-detector-azure';
import { gcpDetector } from '@opentelemetry/resource-detector-gcp';
import { gitHubDetector } from '@opentelemetry/resource-detector-github';
import {
  detectResources,
  envDetector,
  resourceFromAttributes,
} from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { isPromise } from '@sindresorhus/is';
import { pkg } from '../expose.cjs';
import { getEnv } from '../util/env';
import { GitOperationSpanProcessor } from '../util/git/span-processor';
import type { RenovateSpanOptions } from './types';
import {
  isTraceDebuggingEnabled,
  isTraceSendingEnabled,
  isTracingEnabled,
  massageThrowable,
} from './utils';

let instrumentations: Instrumentation[] = [];

init();

export function init(): void {
  if (!isTracingEnabled()) {
    return;
  }

  const spanProcessors: SpanProcessor[] = [];
  // add processors
  if (isTraceDebuggingEnabled()) {
    spanProcessors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  }

  // OTEL specification environment variable
  if (isTraceSendingEnabled()) {
    const exporter = new OTLPTraceExporter();
    spanProcessors.push(new BatchSpanProcessor(exporter));
    spanProcessors.push(new GitOperationSpanProcessor());
  }

  const env = getEnv();
  const baseResource = resourceFromAttributes({
    // https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/resource/semantic_conventions/README.md#semantic-attributes-with-sdk-provided-default-value
    [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME ?? 'renovate',
    // https://github.com/open-telemetry/opentelemetry-js/tree/main/semantic-conventions#unstable-semconv
    // https://github.com/open-telemetry/opentelemetry-js/blob/e9d3c71918635d490b6a9ac9f8259265b38394d0/semantic-conventions/src/experimental_attributes.ts#L7688
    ['service.namespace']: env.OTEL_SERVICE_NAMESPACE ?? 'renovatebot.com',
    [ATTR_SERVICE_VERSION]: env.OTEL_SERVICE_VERSION ?? pkg.version,
  });

  const detectedResource = detectResources({
    detectors: [
      awsBeanstalkDetector,
      awsEc2Detector,
      awsEcsDetector,
      awsEksDetector,
      awsLambdaDetector,
      azureAppServiceDetector,
      azureFunctionsDetector,
      azureVmDetector,
      gcpDetector,
      gitHubDetector,
      envDetector,
    ],
  });

  const traceProvider = new NodeTracerProvider({
    resource: baseResource.merge(detectedResource),
    spanProcessors,
  });

  const contextManager = new AsyncLocalStorageContextManager();
  traceProvider.register({
    contextManager,
  });

  instrumentations = [
    new HttpInstrumentation({
      /* v8 ignore next -- not easily testable */
      applyCustomAttributesOnSpan: (span, request, response) => {
        // ignore 404 errors when the branch protection of Github could not be found. This is expected if no rules are configured
        /* v8 ignore next -- not easily testable */
        if (
          request instanceof ClientRequest &&
          request.host === `api.github.com` &&
          request.path.endsWith(`/protection`) &&
          response.statusCode === 404
        ) {
          span.setStatus({ code: SpanStatusCode.OK });
        }
      },
    }),
    new BunyanInstrumentation(),
    new RedisInstrumentation(),
  ];
  registerInstrumentations({
    instrumentations,
  });
}

// https://github.com/open-telemetry/opentelemetry-js-api/issues/34
/* v8 ignore next -- not easily testable */
export async function shutdown(): Promise<void> {
  const traceProvider = getTracerProvider();
  if (traceProvider instanceof NodeTracerProvider) {
    await traceProvider.shutdown();
  } else if (traceProvider instanceof ProxyTracerProvider) {
    const delegateProvider = traceProvider.getDelegate();
    if (delegateProvider instanceof NodeTracerProvider) {
      await delegateProvider.shutdown();
    }
  }
}

export function disableInstrumentations(): void {
  for (const instrumentation of instrumentations) {
    instrumentation.disable();
  }
}

export function getTracerProvider(): TracerProvider {
  return api.trace.getTracerProvider();
}

function getTracer(): Tracer {
  return getTracerProvider().getTracer('renovate');
}

export function instrument<F extends () => ReturnType<F>>(
  name: string,
  fn: F,
): ReturnType<F>;
export function instrument<F extends () => ReturnType<F>>(
  name: string,
  fn: F,
  options: RenovateSpanOptions,
): ReturnType<F>;
export function instrument<F extends () => ReturnType<F>>(
  name: string,
  fn: F,
  options: RenovateSpanOptions,
  context: Context,
): ReturnType<F>;
export function instrument<F extends () => ReturnType<F>>(
  name: string,
  fn: F,
  options: RenovateSpanOptions = {},
  context: Context = api.context.active(),
): ReturnType<F> {
  return getTracer().startActiveSpan(name, options, context, (span: Span) => {
    try {
      const ret = fn();
      if (isPromise(ret)) {
        return ret
          .catch((e) => {
            span.recordException(e);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: massageThrowable(e),
            });
            throw e;
          })
          .finally(() => span.end()) as ReturnType<F>;
      }
      span.end();
      return ret;
    } catch (e) {
      span.recordException(e);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: massageThrowable(e),
      });
      span.end();
      throw e;
    }
  });
}
