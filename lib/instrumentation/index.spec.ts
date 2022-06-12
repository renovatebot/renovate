import { ProxyTracerProvider } from '@opentelemetry/api';
import * as api from '@opentelemetry/api';
import { NoopTracerProvider } from '@opentelemetry/api/build/src/trace/NoopTracerProvider';
import { MultiSpanProcessor } from '@opentelemetry/sdk-trace-base/build/src/MultiSpanProcessor';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { getTracerProvider, init } from './index';

jest.unmock('.');

describe('instrumentation/index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.trace.disable(); // clear global components
  });

  it('should use NoopTraceProvider if not activated', () => {
    init();
    const traceProvider = getTracerProvider();
    expect(traceProvider).toBeInstanceOf(ProxyTracerProvider);
    const provider = traceProvider as ProxyTracerProvider;
    expect(provider.getDelegate()).toBeInstanceOf(NoopTracerProvider);
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
    const provider = nodeProvider.getActiveSpanProcessor();
    expect(provider).toBeInstanceOf(MultiSpanProcessor);
    expect(provider).toMatchSnapshot();
  });

  it('activate and remote logger', () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'https://collector.example.com';

    init();
    const traceProvider = getTracerProvider();
    expect(traceProvider).toBeInstanceOf(ProxyTracerProvider);
    const proxyProvider = traceProvider as ProxyTracerProvider;
    const delegateProvider = proxyProvider.getDelegate();
    expect(delegateProvider).toBeInstanceOf(NodeTracerProvider);
    const nodeProvider = delegateProvider as NodeTracerProvider;
    const provider = nodeProvider.getActiveSpanProcessor();
    expect(provider).toBeInstanceOf(MultiSpanProcessor);
    expect(provider).toMatchSnapshot();
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
    const provider = nodeProvider.getActiveSpanProcessor();
    expect(provider).toBeInstanceOf(MultiSpanProcessor);
    expect(provider).toMatchSnapshot();
  });
});
