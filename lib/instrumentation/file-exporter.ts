import { appendFile } from 'node:fs/promises';
import { diag } from '@opentelemetry/api';
import { JsonTraceSerializer } from '@opentelemetry/otlp-transformer';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';

// ExportResultCode values from @opentelemetry/core (not a direct dependency)
const SUCCESS = 0;
const FAILED = 1;

export class FileSpanExporter implements SpanExporter {
  private readonly _filePath: string;
  private _stopped = false;

  constructor(filePath: string) {
    this._filePath = filePath;
  }

  export(
    spans: ReadableSpan[],
    resultCallback: (result: { code: number; error?: Error }) => void,
  ): void {
    if (this._stopped) {
      resultCallback({ code: FAILED });
      return;
    }

    void this._writeSpans(spans).then(
      () => resultCallback({ code: SUCCESS }),
      (error) => {
        diag.error('FileSpanExporter failed to write spans', error);
        resultCallback({ code: FAILED, error });
      },
    );
  }

  private async _writeSpans(spans: ReadableSpan[]): Promise<void> {
    const serialized = JsonTraceSerializer.serializeRequest(spans);
    if (serialized === undefined) {
      return;
    }
    const line = Buffer.from(serialized).toString('utf-8') + '\n';
    await appendFile(this._filePath, line, 'utf-8');
  }

  shutdown(): Promise<void> {
    this._stopped = true;
    return Promise.resolve();
  }

  forceFlush(): Promise<void> {
    // no-op: writes are immediate
    return Promise.resolve();
  }
}
