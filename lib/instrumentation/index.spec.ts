import * as api from '@opentelemetry/api';
import { ProxyTracerProvider } from '@opentelemetry/api';
import { OTLPTraceExporter as OTLPTraceExporterGrpc } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPTraceExporter as OTLPTraceExporterHttp } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPTraceExporter as OTLPTraceExporterProto } from '@opentelemetry/exporter-trace-otlp-proto';
import {
  BatchSpanProcessor,
  NodeTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { type DirectoryResult, dir } from 'tmp-promise';
import upath from 'upath';
import { bunyan } from '../expose.ts';
import { GetDatasourceReleasesSpanProcessor } from '../modules/datasource/span-processor.ts';
import { GitOperationSpanProcessor } from '../util/git/span-processor.ts';
import { FileSpanExporter } from './file-exporter.ts';
import {
  disableInstrumentations,
  getTracerProvider,
  init,
  instrument,
} from './index.ts';

function getOtlpExporter(nodeProvider: NodeTracerProvider): unknown {
  const spanProcessors = (nodeProvider as any)._activeSpanProcessor
    ._spanProcessors as { _exporter: unknown }[];
  // the OTLP exporter is always the last processor registered in these tests
  return spanProcessors.at(-1)!._exporter;
}

afterAll(disableInstrumentations);

describe('instrumentation/index', () => {
  let tmpDir: DirectoryResult;

  beforeEach(async () => {
    tmpDir = await dir({ unsafeCleanup: true });

    api.trace.disable(); // clear global components

    // remove any otel env
    for (const key in process.env) {
      if (key.startsWith('OTEL_')) {
        vi.stubEnv(key, undefined);
      }
    }
    vi.stubEnv('RENOVATE_TRACING_CONSOLE_EXPORTER', undefined);
    vi.stubEnv('RENOVATE_TRACING_FILE_EXPORTER_PATH', undefined);
    // prevent real network calls to cloud metadata endpoints (AWS/GCP/Azure) during tests
    vi.stubEnv('RENOVATE_USE_CLOUD_METADATA_SERVICES', 'false');
  });

  afterAll(async () => {
    await tmpDir.cleanup();
  });

  it('should use NoopTraceProvider if not activated', () => {
    init();
    const traceProvider = getTracerProvider();
    expect(traceProvider).toBeInstanceOf(ProxyTracerProvider);
    const provider = traceProvider as ProxyTracerProvider;
    expect(provider.constructor.name).toBe('ProxyTracerProvider');
  });

  it('activate console logger', () => {
    vi.stubEnv('RENOVATE_TRACING_CONSOLE_EXPORTER', 'true');

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

  it('registers OpenTelemetry file exporter if enabled', () => {
    vi.stubEnv(
      'RENOVATE_TRACING_FILE_EXPORTER_PATH',
      upath.join(tmpDir.path, 'test-traces.jsonl'),
    );

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
          expect.any(BatchSpanProcessor),
        ],
      },
    });
    // Verify the SimpleSpanProcessor wraps a FileSpanExporter
    const spanProcessors = (nodeProvider as any)._activeSpanProcessor
      ._spanProcessors;
    const fileProcessor = spanProcessors[2];
    expect(fileProcessor._exporter).toBeInstanceOf(FileSpanExporter);
  });

  it('registers GitOperationSpanProcessor, GetDatasourceReleasesSpanProcessor regardless of tracing being enabled', () => {
    // intentionally don't set it
    vi.stubEnv('RENOVATE_TRACING_CONSOLE_EXPORTER', undefined);
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', undefined);

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
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'https://collector.example.com');

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
    // defaults to the http/json exporter when no protocol is configured
    expect(getOtlpExporter(nodeProvider)).toBeInstanceOf(OTLPTraceExporterHttp);
  });

  it('activate remote logger with grpc protocol', () => {
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'https://collector.example.com');
    vi.stubEnv('OTEL_EXPORTER_OTLP_PROTOCOL', 'grpc');

    init();
    const traceProvider = getTracerProvider();
    const proxyProvider = traceProvider as ProxyTracerProvider;
    const delegateProvider = proxyProvider.getDelegate();
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
                  _parameters: {
                    address: 'collector.example.com',
                  },
                },
              },
            },
          },
        ],
      },
    });
    expect(getOtlpExporter(nodeProvider)).toBeInstanceOf(OTLPTraceExporterGrpc);
  });

  it('activate remote logger with http/protobuf protocol', () => {
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'https://collector.example.com');
    vi.stubEnv('OTEL_EXPORTER_OTLP_PROTOCOL', 'http/protobuf');

    init();
    const traceProvider = getTracerProvider();
    const proxyProvider = traceProvider as ProxyTracerProvider;
    const delegateProvider = proxyProvider.getDelegate();
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
    expect(getOtlpExporter(nodeProvider)).toBeInstanceOf(
      OTLPTraceExporterProto,
    );
  });

  it('activate remote logger with http/json protocol', () => {
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'https://collector.example.com');
    vi.stubEnv('OTEL_EXPORTER_OTLP_PROTOCOL', 'http/json');

    init();
    const traceProvider = getTracerProvider();
    const proxyProvider = traceProvider as ProxyTracerProvider;
    const delegateProvider = proxyProvider.getDelegate();
    const nodeProvider = delegateProvider as NodeTracerProvider;
    expect(getOtlpExporter(nodeProvider)).toBeInstanceOf(OTLPTraceExporterHttp);
  });

  it('takes precedence from the `_TRACES` env var, if set', () => {
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'https://collector.example.com');
    vi.stubEnv('OTEL_EXPORTER_OTLP_PROTOCOL', 'http/json');
    vi.stubEnv('OTEL_EXPORTER_OTLP_TRACES_PROTOCOL', 'http/protobuf');

    init();
    const traceProvider = getTracerProvider();
    const proxyProvider = traceProvider as ProxyTracerProvider;
    const delegateProvider = proxyProvider.getDelegate();
    const nodeProvider = delegateProvider as NodeTracerProvider;
    expect(getOtlpExporter(nodeProvider)).toBeInstanceOf(
      OTLPTraceExporterProto,
    );
  });

  it('defaults to http/json protocol if the specified protocol has a typo', () => {
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'https://collector.example.com');
    vi.stubEnv('OTEL_EXPORTER_OTLP_PROTOCOL', 'http/jayson');

    init();
    const traceProvider = getTracerProvider();
    const proxyProvider = traceProvider as ProxyTracerProvider;
    const delegateProvider = proxyProvider.getDelegate();
    const nodeProvider = delegateProvider as NodeTracerProvider;
    expect(getOtlpExporter(nodeProvider)).toBeInstanceOf(OTLPTraceExporterHttp);
  });

  it('activate console logger and remote logger', () => {
    vi.stubEnv('RENOVATE_TRACING_CONSOLE_EXPORTER', 'true');
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'https://collector.example.com');

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
    expect(getOtlpExporter(nodeProvider)).toBeInstanceOf(OTLPTraceExporterHttp);
  });

  describe('BunyanInstrumentation', () => {
    // OpenTelemetry's context propagation currently uses `AsyncLocalStorage`, which does not behave the same way in vitest worker threads as in a real Node.js process, so we cannot write a full end-to-end here to validate the `span_id`, `trace_id` and `trace_flags` are set
    //
    // Claude Sonnet 4.6 suggests that we instead create an (admittedly brittle) test to validate that this is marked as `__wrapped`.
    it('patches bunyan Logger._emit when tracing is enabled', () => {
      vi.stubEnv('RENOVATE_TRACING_CONSOLE_EXPORTER', 'true');
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
