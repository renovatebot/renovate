import type { Context } from '@opentelemetry/api';
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { ATTR_VCS_GIT_OPERATION_TYPE } from '../../instrumentation/types.ts';
import { GitOperationStats } from '../stats.ts';
import type { GitOperationType } from './types.ts';

export class GitOperationSpanProcessor implements SpanProcessor {
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  onStart(_span: Span, _parentContext: Context): void {
    // no implementation
  }

  // v8 ignore next -- TODO: add test #40625
  onEnd(span: ReadableSpan): void {
    if (!span.ended) {
      return;
    }

    if (!span.attributes[ATTR_VCS_GIT_OPERATION_TYPE]) {
      return;
    }

    const start = span.startTime; // [seconds, nanos]
    const end = span.endTime; // [seconds, nanos]
    const startNs = start[0] * 1e9 + start[1];
    const endNs = end[0] * 1e9 + end[1];
    const ns = endNs - startNs;

    GitOperationStats.write(
      span.attributes[ATTR_VCS_GIT_OPERATION_TYPE] as GitOperationType,
      ns / 1_000_000,
    );
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
