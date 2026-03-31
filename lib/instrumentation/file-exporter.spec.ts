import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { FileSpanExporter } from './file-exporter.ts';

vi.mock('node:fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
}));

const { appendFile } = vi.mocked(await import('node:fs/promises'));

function createMockSpan(overrides: Partial<ReadableSpan> = {}): ReadableSpan {
  return {
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
    resource: {
      attributes: {},
      merge: vi.fn(),
    },
    instrumentationLibrary: { name: 'test' },
    instrumentationScope: { name: 'test' },
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
    parentSpanId: undefined,
    ...overrides,
  } as unknown as ReadableSpan;
}

// ExportResultCode values from @opentelemetry/core
const ExportResultCode = { SUCCESS: 0, FAILED: 1 };

describe('instrumentation/file-exporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes OTLP JSON line to file', async () => {
    const exporter = new FileSpanExporter('/tmp/test-traces.jsonl');
    const spans = [createMockSpan()];

    const result = await new Promise<{ code: number }>((resolve) => {
      exporter.export(spans, resolve);
    });

    expect(result.code).toBe(ExportResultCode.SUCCESS);
    expect(appendFile).toHaveBeenCalledTimes(1);
    expect(appendFile).toHaveBeenCalledWith(
      '/tmp/test-traces.jsonl',
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
    const exporter = new FileSpanExporter('/tmp/test-traces.jsonl');

    const result = await new Promise<{ code: number }>((resolve) => {
      exporter.export([createMockSpan()], resolve);
    });

    expect(result.code).toBe(ExportResultCode.FAILED);
  });

  it('reports FAILED after shutdown', async () => {
    const exporter = new FileSpanExporter('/tmp/test-traces.jsonl');
    await exporter.shutdown();

    const result = await new Promise<{ code: number }>((resolve) => {
      exporter.export([createMockSpan()], resolve);
    });

    expect(result.code).toBe(ExportResultCode.FAILED);
    expect(appendFile).not.toHaveBeenCalled();
  });

  it('forceFlush resolves immediately', async () => {
    const exporter = new FileSpanExporter('/tmp/test-traces.jsonl');
    await expect(exporter.forceFlush()).resolves.toBeUndefined();
  });
});
