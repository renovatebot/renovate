import { appendFile } from 'node:fs/promises';
import { diag } from '@opentelemetry/api';
import { JsonTraceSerializer } from '@opentelemetry/otlp-transformer';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';

// Taken from https://github.com/open-telemetry/opentelemetry-js/blob/2.10.0/packages/opentelemetry-core/src/ExportResult.ts and inlined, as we don't need to add an unnecessary dependency for this type that doesn't change
export enum ExportResultCode {
  SUCCESS,
  FAILED,
}

export class FileSpanExporter implements SpanExporter {
  private readonly filePath: string;
  private stopped = false;
  private readonly pendingWrites = new Set<Promise<void>>();

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  export(
    spans: ReadableSpan[],
    resultCallback: (result: { code: number; error?: Error }) => void,
  ): void {
    if (this.stopped) {
      resultCallback({ code: ExportResultCode.SUCCESS });
      return;
    }

    const pending = this.writeSpans(spans).then(
      () => resultCallback({ code: ExportResultCode.SUCCESS }),
      (error) => {
        diag.error('FileSpanExporter failed to write spans', error);
        resultCallback({ code: ExportResultCode.FAILED, error });
      },
    );
    this.pendingWrites.add(pending);
    void pending.finally(() => this.pendingWrites.delete(pending));
  }

  private async writeSpans(spans: ReadableSpan[]): Promise<void> {
    const serialized = JsonTraceSerializer.serializeRequest(spans);
    /* v8 ignore start -- upstream type allows `undefined`, but the JSON serializer never returns it */
    if (serialized === undefined) {
      return;
    }
    /* v8 ignore stop */
    const line = `${Buffer.from(serialized).toString('utf-8')}\n`;
    await appendFile(this.filePath, line, 'utf-8');
  }

  async shutdown(): Promise<void> {
    this.stopped = true;
    await this.forceFlush();
  }

  async forceFlush(): Promise<void> {
    await Promise.all(this.pendingWrites);
  }
}
