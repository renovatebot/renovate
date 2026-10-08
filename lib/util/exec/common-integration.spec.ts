import { SpanStatusCode, trace } from '@opentelemetry/api';
import {
  InMemorySpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import {
  addSecretForSanitizing,
  clearRepoSanitizedSecretsList,
} from '../sanitize.ts';
import { rawExec } from './common.ts';
import { ExecError } from './exec-error.ts';

vi.unmock('./common.ts');

describe('util/exec/common-integration', () => {
  it('redacts failed command output before recording telemetry', async () => {
    const exporter = new InMemorySpanExporter();
    const provider = new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    trace.disable();
    trace.setGlobalTracerProvider(provider);
    const input = 'SYNTHETIC_PRIVATE_MANIFEST';
    addSecretForSanitizing(input);

    try {
      const error = await rawExec(
        {
          command: [
            process.execPath,
            '-e',
            'process.stdin.pipe(process.stdout); process.stdin.pipe(process.stderr); process.exitCode = 1;',
          ],
        },
        { input, redactOutput: true },
      ).catch((caught: unknown) => caught);

      await provider.forceFlush();

      expect(error).toBeInstanceOf(ExecError);
      expect(error).toMatchObject({
        stdout: input,
        stderr: input,
        exitCode: 1,
        message: expect.not.stringContaining(input),
        stack: expect.not.stringContaining(input),
      });
      expect(error).not.toHaveProperty('options.input');
      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0].status).toEqual({
        code: SpanStatusCode.ERROR,
        message: expect.not.stringContaining(input),
      });
      expect(spans[0].events).toEqual([
        expect.objectContaining({
          name: 'exception',
          attributes: {
            'exception.type': 'ExecError',
            'exception.message': expect.not.stringContaining(input),
            'exception.stacktrace': expect.not.stringContaining(input),
          },
        }),
      ]);
    } finally {
      await provider.shutdown();
      trace.disable();
      clearRepoSanitizedSecretsList();
    }
  });
});
