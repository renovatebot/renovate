import * as api from '@opentelemetry/api';
import { ProxyTracerProvider } from '@opentelemetry/api';
import {
  NodeTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { bunyan } from '../expose.ts';
import { GetDatasourceReleasesSpanProcessor } from '../modules/datasource/span-processor.ts';
import { GitOperationSpanProcessor } from '../util/git/span-processor.ts';
import {
  disableInstrumentations,
  getTracerProvider,
  init,
  instrument,
} from './index.ts';

afterAll(disableInstrumentations);

describe('instrumentation/index', () => {
  const oldEnv = process.env;

  beforeEach(() => {
    api.trace.disable(); // clear global components
    process.env = { ...oldEnv };

    // remove any otel env
    for (const key in process.env) {
      if (key.startsWith('OTEL_')) {
        delete process.env[key];
      }
    }
    delete process.env.RENOVATE_TRACING_CONSOLE_EXPORTER;
    delete process.env.RENOVATE_USE_CLOUD_METADATA_SERVICES;
  });

  afterAll(() => {
    process.env = oldEnv; // Restore old environment
  });

  it('should use NoopTraceProvider if not activated', () => {
    init();
    const traceProvider = getTracerProvider();
    expect(traceProvider).toBeInstanceOf(ProxyTracerProvider);
    const provider = traceProvider as ProxyTracerProvider;
    expect(provider.constructor.name).toBe('ProxyTracerProvider');
  });

  it('activate console logger', () => {
    process.env.RENOVATE_TRACING_CONSOLE_EXPORTER = 'true';

    init();
    const traceProvider = getTracerProvider();
    expect(traceProvider).toBeInstanceOf(ProxyTracerProvider);
    const proxyProvider = traceProvider as ProxyTracerProvider;
    const delegateProvider = proxyProvider.getDelegate();
    expect(delegateProvider).toBeInstanceOf(NodeTracerProvider);
    const nodeProvider = delegateProvider as NodeTracerProvider;
    expect(nodeProvider).toMatchObject({
      _activeSpanProcessor: {
        _spanProcessors: [
          new GitOperationSpanProcessor(),
          new GetDatasourceReleasesSpanProcessor(),
          expect.any(SimpleSpanProcessor),
        ],
      },
    });
  });

  it('registers GitOperationSpanProcessor, GetDatasourceReleasesSpanProcessor regardless of tracing being enabled', () => {
    // intentionally don't set it
    delete process.env.RENOVATE_TRACING_CONSOLE_EXPORTER;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

    init();
    const traceProvider = getTracerProvider();
    const proxyProvider = traceProvider as ProxyTracerProvider;
    const delegateProvider = proxyProvider.getDelegate();
    const nodeProvider = delegateProvider as NodeTracerProvider;
    expect(nodeProvider).toMatchObject({
      _activeSpanProcessor: {
        _spanProcessors: expect.arrayContaining([
          new GitOperationSpanProcessor(),
          new GetDatasourceReleasesSpanProcessor(),
        ]),
      },
    });
  });

  it('activate remote logger', () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'https://collector.example.com';

    init();
    const traceProvider = getTracerProvider();
    expect(traceProvider).toBeInstanceOf(ProxyTracerProvider);
    const proxyProvider = traceProvider as ProxyTracerProvider;
    const delegateProvider = proxyProvider.getDelegate();
    expect(delegateProvider).toBeInstanceOf(NodeTracerProvider);
    const nodeProvider = delegateProvider as NodeTracerProvider;
    expect(nodeProvider).toMatchObject({
      _activeSpanProcessor: {
        _spanProcessors: [
          new GitOperationSpanProcessor(),
          new GetDatasourceReleasesSpanProcessor(),
          {
            _exporter: {
              _delegate: {
                _transport: {
                  _transport: {
                    _parameters: {
                      url: 'https://collector.example.com/v1/traces',
                    },
                  },
                },
              },
            },
          },
        ],
      },
    });
  });

  it('activate console logger and remote logger', () => {
    process.env.RENOVATE_TRACING_CONSOLE_EXPORTER = 'true';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'https://collector.example.com';

    init();
    const traceProvider = getTracerProvider();
    expect(traceProvider).toBeInstanceOf(ProxyTracerProvider);
    const proxyProvider = traceProvider as ProxyTracerProvider;
    const delegateProvider = proxyProvider.getDelegate();
    expect(delegateProvider).toBeInstanceOf(NodeTracerProvider);
    const nodeProvider = delegateProvider as NodeTracerProvider;
    expect(nodeProvider).toMatchObject({
      _activeSpanProcessor: {
        _spanProcessors: [
          new GitOperationSpanProcessor(),
          new GetDatasourceReleasesSpanProcessor(),
          { _exporter: {} },
          {
            _exporter: {
              _delegate: {
                _transport: {
                  _transport: {
                    _parameters: {
                      url: 'https://collector.example.com/v1/traces',
                    },
                  },
                },
              },
            },
          },
        ],
      },
    });
  });

  describe('BunyanInstrumentation', () => {
    // OpenTelemetry's context propagation currently uses `AsyncLocalStorage`, which does not behave the same way in vitest worker threads as in a real Node.js process, so we cannot write a full end-to-end here to validate the `span_id`, `trace_id` and `trace_flags` are set
    //
    // Claude Sonnet 4.6 suggests that we instead create an (admittedly brittle) test to validate that this is marked as `__wrapped`.
    it('patches bunyan Logger._emit when tracing is enabled', () => {
      process.env.RENOVATE_TRACING_CONSOLE_EXPORTER = 'true';
      init();

      const mod = bunyan();

      // shimmer marks wrapped functions with __wrapped = true
      expect(
        (mod.prototype as unknown as Record<string, unknown>)._emit,
      ).toHaveProperty('__wrapped', true);
    });
  });

  describe('instrument', () => {
    it('should return result', () => {
      const value = 'testResult';
      const result = instrument('test', () => {
        return value;
      });
      expect(result).toStrictEqual(value);
    });

    it('should rethrow exception', () => {
      const error = new Error('testError');
      expect(() =>
        instrument('test', () => {
          throw error;
        }),
      ).toThrow(error);
    });

    it('should return result for async fn', async () => {
      const value = 'testResult';
      const result = await instrument('test', async () => {
        return await new Promise((resolve) => {
          resolve(value);
        });
      });
      expect(result).toStrictEqual(value);
    });

    it('should rethrow exception for async fn', async () => {
      const error = new Error('testError');
      await expect(
        instrument('test', async () => {
          await Promise.resolve();
          throw error;
        }),
      ).rejects.toThrow(error);
    });
  });
});
