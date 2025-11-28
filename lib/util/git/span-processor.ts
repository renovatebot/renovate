import type { Context } from '@opentelemetry/api';
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { ATTR_VCS_GIT_OPERATION_TYPE } from '../../instrumentation/types';
import { GitOperationStats } from '../stats';
import type { GitOperationType } from './instrument';

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

    const ns = span.duration[1];

    GitOperationStats.write(
      span.attributes[ATTR_VCS_GIT_OPERATION_TYPE] as GitOperationType,
      ns / 1000,
    );
  }
  async shutdown(): Promise<void> {
    // no implementation
  }
}
