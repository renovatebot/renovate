import type { Context } from '@opentelemetry/api';
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { ATTR_VCS_GIT_OPERATION_TYPE } from '../../instrumentation/types';
import { GitOperationStats } from '../stats';
import type { GitOperationType } from './types';

export class GitOperationSpanProcessor implements SpanProcessor {
  async forceFlush(): Promise<void> {
    // no implementation
  }
  onStart(span: Span, parentContext: Context): void {
    // no implementation
  }
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
  async shutdown(): Promise<void> {
    // no implementation
  }
}
