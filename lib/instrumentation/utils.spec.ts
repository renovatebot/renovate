import * as api from '@opentelemetry/api';
import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import upath from 'upath';
import { partial } from '~test/util.ts';
import { disableInstrumentations, init, instrument } from './index.ts';
import { getTraceContextEnv, massageThrowable } from './utils.ts';

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

  describe('getTraceContextEnv', () => {
    const oldEnv = process.env;
    let tmpDir: DirectoryResult;

    beforeEach(async () => {
      tmpDir = await dir({ unsafeCleanup: true });

      api.trace.disable();
      process.env = { ...oldEnv };
      for (const key of Object.keys(process.env)) {
        if (key.startsWith('OTEL_')) {
          delete process.env[key];
        }
      }
      delete process.env.RENOVATE_TRACING_CONSOLE_EXPORTER;
      delete process.env.RENOVATE_TRACING_FILE_EXPORTER_PATH;
      process.env.RENOVATE_USE_CLOUD_METADATA_SERVICES = 'false';
    });

    afterEach(async () => {
      disableInstrumentations();
      await tmpDir.cleanup();
    });

    afterAll(() => {
      process.env = oldEnv;
    });

    function enableFileTracing(): void {
      process.env.RENOVATE_TRACING_FILE_EXPORTER_PATH = upath.join(
        tmpDir.path,
        'test-traces.jsonl',
      );
      init();
    }

    it('returns an empty object when tracing is disabled', () => {
      expect(getTraceContextEnv()).toEqual({});
    });

    it('returns an empty object when tracing is enabled but there is no active span', () => {
      enableFileTracing();

      expect(getTraceContextEnv()).toEqual({});
    });

    it('injects the active trace context as TRACEPARENT when tracing is enabled', () => {
      enableFileTracing();

      let env: NodeJS.ProcessEnv = {};
      instrument('test', () => {
        env = getTraceContextEnv();
      });

      expect(env.TRACEPARENT).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/);
    });

    it('injects TRACESTATE when the active span context has a traceState', () => {
      enableFileTracing();

      const spanContext: api.SpanContext = {
        traceId: '0af7651916cd43dd8448eb211c80319c',
        spanId: 'b7ad6b7169203331',
        traceFlags: api.TraceFlags.SAMPLED,
        traceState: partial<api.TraceState>({
          serialize: () => 'vendor=value',
        }),
      };
      const ctx = api.trace.setSpanContext(api.context.active(), spanContext);

      const env = api.context.with(ctx, getTraceContextEnv);

      expect(env.TRACESTATE).toBe('vendor=value');
    });
  });
});
