import type { Resource } from '@opentelemetry/resources';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import upath from 'upath';
import { partial } from '~test/util.ts';
import { FileSpanExporter } from './file-exporter.ts';

vi.mock('node:fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
}));

const { appendFile } = vi.mocked(await import('node:fs/promises'));

function createMockSpan(overrides: Partial<ReadableSpan> = {}): ReadableSpan {
  return partial<ReadableSpan>({
    name: 'test-span',
    kind: 0,
    spanContext: () => ({
      traceId: '00000000000000000000000000000001',
      spanId: '0000000000000001',
      traceFlags: 1,
    }),
    startTime: [0, 0],
    endTime: [1, 0],
    status: { code: 0 },
    attributes: {},
    links: [],
    events: [],
    duration: [1, 0],
    ended: true,
    resource: partial<Resource>({
      attributes: {},
      merge: vi.fn(),
    }),
    instrumentationScope: { name: 'test' },
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
    parentSpanContext: undefined,
    ...overrides,
  });
}

// ExportResultCode values from @opentelemetry/core
const ExportResultCode = { SUCCESS: 0, FAILED: 1 };

describe('instrumentation/file-exporter', () => {
  let tmpDir: DirectoryResult;
  beforeEach(async () => {
    tmpDir = await dir({ unsafeCleanup: true });
  });

  afterAll(async () => {
    await tmpDir?.cleanup();
  });

  it('writes OTLP JSON line to file', async () => {
    const tracesPath = upath.join(tmpDir.path, 'test-traces.jsonl');

    const exporter = new FileSpanExporter(tracesPath);
    const spans = [createMockSpan()];

    const result = await new Promise<{ code: number }>((resolve) => {
      exporter.export(spans, resolve);
    });

    expect(result.code).toBe(ExportResultCode.SUCCESS);
    expect(appendFile).toHaveBeenCalledTimes(1);
    expect(appendFile).toHaveBeenCalledWith(
      tracesPath,
      expect.stringMatching(/^\{.*"resourceSpans".*\}\n$/),
      'utf-8',
    );

    // Verify the written content is valid JSON
    const writtenContent = appendFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(writtenContent.trim());
    expect(parsed).toHaveProperty('resourceSpans');
  });

  it('reports FAILED on write error', async () => {
    appendFile.mockRejectedValueOnce(new Error('disk full'));
    const exporter = new FileSpanExporter(
      upath.join(tmpDir.path, 'test-traces.jsonl'),
    );

    const result = await new Promise<{ code: number }>((resolve) => {
      exporter.export([createMockSpan()], resolve);
    });

    expect(result.code).toBe(ExportResultCode.FAILED);
  });

  it('reports FAILED after shutdown', async () => {
    const exporter = new FileSpanExporter(
      upath.join(tmpDir.path, 'test-traces.jsonl'),
    );
    await exporter.shutdown();

    const result = await new Promise<{ code: number }>((resolve) => {
      exporter.export([createMockSpan()], resolve);
    });

    expect(result.code).toBe(ExportResultCode.FAILED);
    expect(appendFile).not.toHaveBeenCalled();
  });

  it('forceFlush resolves immediately when there are no pending writes', async () => {
    const exporter = new FileSpanExporter(
      upath.join(tmpDir.path, 'test-traces.jsonl'),
    );
    await expect(exporter.forceFlush()).resolves.toBeUndefined();
  });

  it('waits for an in-flight write to finish before shutdown resolves', async () => {
    const events: string[] = [];
    let resolveWrite!: () => void;
    appendFile.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );

    const exporter = new FileSpanExporter(
      upath.join(tmpDir.path, 'test-traces.jsonl'),
    );

    exporter.export([createMockSpan()], () => {
      events.push('export-callback');
    });

    const shutdownPromise = exporter.shutdown().then(() => {
      events.push('shutdown-resolved');
    });

    // let any already-queued microtasks run; the write is still pending, so
    // neither the export callback nor shutdown() should have resolved yet
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual([]);

    resolveWrite();
    await shutdownPromise;

    expect(events).toEqual(['export-callback', 'shutdown-resolved']);
  });

  it('waits for an in-flight write to finish before forceFlush resolves', async () => {
    const events: string[] = [];
    let resolveWrite!: () => void;
    appendFile.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );

    const exporter = new FileSpanExporter(
      upath.join(tmpDir.path, 'test-traces.jsonl'),
    );

    exporter.export([createMockSpan()], () => {
      events.push('export-callback');
    });

    const forceFlushPromise = exporter.forceFlush().then(() => {
      events.push('forceFlush-resolved');
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual([]);

    resolveWrite();
    await forceFlushPromise;

    expect(events).toEqual(['export-callback', 'forceFlush-resolved']);
  });
});
