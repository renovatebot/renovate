import { SpanStatusCode, trace } from '@opentelemetry/api';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from '@opentelemetry/sdk-trace';
import { rawExec } from './common.ts';
import { ExecError } from './exec-error.ts';

vi.unmock('./common.ts');

describe('util/exec/common.integration', () => {
  it('disables Execa verbose output when redacting command output', async () => {
    const verbose = vi.fn();
    const input = 'private input';

    await expect(
      rawExec(
        {
          command: [
            process.execPath,
            '-e',
            'process.stdin.pipe(process.stdout);',
          ],
        },
        { input, verbose, redactOutput: true },
      ),
    ).resolves.toEqual({ stdout: input, stderr: '' });

    expect(verbose).not.toHaveBeenCalled();
  });

  it.each(['private input', Buffer.from('private input'), ''])(
    'delivers input to a real process without discarding its output',
    async (input) => {
      await expect(
        rawExec(
          {
            command: [
              process.execPath,
              '-e',
              'process.stdin.pipe(process.stdout);',
            ],
          },
          { input, redactOutput: true },
        ),
      ).resolves.toEqual({ stdout: input.toString(), stderr: '' });
    },
  );

  it('preserves a spawn failure without retaining the input', async () => {
    const error = await rawExec('renovate-nonexistent-test-executable', {
      input: 'private input',
      redactOutput: true,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ExecError);
    expect(error).toMatchObject({ message: expect.stringContaining('ENOENT') });
    expect(error).not.toHaveProperty('options.input');
  });

  it('settles when a process exits without reading a large input', async () => {
    await expect(
      rawExec(
        { command: [process.execPath, '-e', ''] },
        {
          input: Buffer.alloc(128 * 1024, 'x'),
          redactOutput: true,
          timeout: 1000,
        },
      ),
    ).resolves.toEqual({ stdout: '', stderr: '' });
  });

  it('terminates a hung process without retaining the input', async () => {
    const error = await rawExec(
      { command: [process.execPath, '-e', 'setInterval(() => {}, 1000);'] },
      { input: 'private input', redactOutput: true, timeout: 100 },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ExecError);
    expect(error).toMatchObject({ signal: 'SIGTERM' });
    expect(error).not.toHaveProperty('options.input');
  });

  it('honors caller cancellation after receiving process output', async () => {
    const controller = new AbortController();
    const input = 'private input';
    const error = await rawExec(
      {
        command: [
          process.execPath,
          '-e',
          'process.stdin.pipe(process.stdout); setInterval(() => {}, 1000);',
        ],
      },
      {
        input,
        redactOutput: true,
        cancelSignal: controller.signal,
        outputListeners: { stdout: [() => controller.abort()] },
      },
    ).catch((caught: unknown) => caught);

    expect(controller.signal.aborted).toBe(true);
    expect(error).toBeInstanceOf(ExecError);
    expect(error).toMatchObject({ stdout: '', stderr: '', signal: 'SIGTERM' });
    expect(error).not.toHaveProperty('options.input');
  });

  it('redacts failed command output before recording telemetry', async () => {
    const exporter = new InMemorySpanExporter();
    const provider = new TracerProvider({
      spanProcessors: [new SimpleSpanProcessor({ exporter })],
    });
    trace.disable();
    trace.setGlobalTracerProvider(provider);
    const input = 'SYNTHETIC_PRIVATE_MANIFEST';

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
        stdout: '',
        stderr: '',
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
    }
  });
});
