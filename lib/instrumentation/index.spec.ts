import { ProxyTracerProvider } from '@opentelemetry/api';
import * as api from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import type { Response, SimpleGit } from 'simple-git';
import {
  disableInstrumentations,
  getTracerProvider,
  init,
  instrument,
} from '.';

afterAll(disableInstrumentations);

describe('instrumentation/index', () => {
  const oldEnv = process.env;

  beforeEach(() => {
    api.trace.disable(); // clear global components
    process.env = { ...oldEnv };
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
        _spanProcessors: [{ _exporter: {} }],
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

    describe('should return result for async fn with intersection type of Promise', async () => {
      const simpleGitMock = {
        status: vi.fn(),
      } as Partial<SimpleGit>;

      const value = 'testResult';

      it('when promise is first type', async () => {
        const promise = Promise.resolve(value);
        // this copies `simpleGitMock` properties onto `promise`
        const prom = Object.assign(promise, simpleGitMock) as Response<string>;

        const result = await instrument('test', () => prom);
        expect(result).toStrictEqual(value);
      });

      it('when promise is second type', async () => {
        const promise = Promise.resolve(value);
        // this copies `promise` properties onto `simpleGitMock`
        const prom = Object.assign(simpleGitMock, promise) as Response<string>;

        const result = await instrument('test', () => prom);
        expect(result).toStrictEqual(value);
      });
    });
  });
});
