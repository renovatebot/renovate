import { getOtlpProtocol, massageThrowable } from './utils.ts';

describe('instrumentation/utils', () => {
  describe('massageThrowable', () => {
    it.each`
      input                | expected
      ${null}              | ${undefined}
      ${undefined}         | ${undefined}
      ${new Error('test')} | ${'test'}
      ${'test'}            | ${'test'}
      ${123}               | ${'123'}
    `('should return $expected for $input', ({ input, expected }) => {
      expect(massageThrowable(input)).toEqual(expected);
    });
  });

  describe('getOtlpProtocol', () => {
    beforeEach(() => {
      vi.stubEnv('OTEL_EXPORTER_OTLP_PROTOCOL', undefined);
      vi.stubEnv('OTEL_EXPORTER_OTLP_TRACES_PROTOCOL', undefined);
    });

    it('defaults to http/json when unset', () => {
      expect(getOtlpProtocol()).toBe('http/json');
    });

    it('defaults to http/json for an unrecognised value', () => {
      vi.stubEnv('OTEL_EXPORTER_OTLP_PROTOCOL', 'unknown-protocol');
      expect(getOtlpProtocol()).toBe('http/json');
    });

    it.each`
      protocol
      ${'grpc'}
      ${'http/json'}
      ${'http/protobuf'}
    `('reads $protocol from OTEL_EXPORTER_OTLP_PROTOCOL', ({ protocol }) => {
      process.env.OTEL_EXPORTER_OTLP_PROTOCOL = protocol;
      expect(getOtlpProtocol()).toBe(protocol);
    });

    it('prefers OTEL_EXPORTER_OTLP_TRACES_PROTOCOL over OTEL_EXPORTER_OTLP_PROTOCOL', () => {
      vi.stubEnv('OTEL_EXPORTER_OTLP_PROTOCOL', 'http/json');
      vi.stubEnv('OTEL_EXPORTER_OTLP_TRACES_PROTOCOL', 'grpc');
      expect(getOtlpProtocol()).toBe('grpc');
    });
  });
});
