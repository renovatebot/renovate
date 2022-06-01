import { NoopSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { MultiSpanProcessor } from '@opentelemetry/sdk-trace-base/build/src/MultiSpanProcessor';
import { getTracerProvider, init } from './index';

jest.unmock('.');

describe('instrumentation/index', () => {
  it('should use NoopSpanProcessor if not activated', () => {
    init();
    const traceProvider = getTracerProvider();
    const provider = traceProvider.getActiveSpanProcessor();
    expect(provider).toStrictEqual(new NoopSpanProcessor());
  });

  it('activate console logger', () => {
    process.env.RENOVATE_DEBUG_TRACING = 'true';

    init();
    const traceProvider = getTracerProvider();
    const provider = traceProvider.getActiveSpanProcessor();
    expect(provider).toBeInstanceOf(MultiSpanProcessor);
    expect(provider).toMatchSnapshot();
  });

  it('activate and remote logger', () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'https://collector.example.com';

    init();
    const traceProvider = getTracerProvider();
    const provider = traceProvider.getActiveSpanProcessor();
    expect(provider).toBeInstanceOf(MultiSpanProcessor);
    expect(provider).toMatchSnapshot();
  });

  it('activate console logger and remote logger', () => {
    process.env.RENOVATE_DEBUG_TRACING = 'true';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'https://collector.example.com';

    init();
    const traceProvider = getTracerProvider();
    const provider = traceProvider.getActiveSpanProcessor();
    expect(provider).toBeInstanceOf(MultiSpanProcessor);
    expect(provider).toMatchSnapshot();
  });
});
