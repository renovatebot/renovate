import type { Attributes, SpanKind } from '@opentelemetry/api';
import { Decorator, decorate } from '../util/decorator';
import { getTracer } from '.';

/**
 * The cache decorator parameters.
 */
interface SpanParameters {
  /**
   * The name of the span
   */
  name: string;

  /**
   * Attributes which should be added to the span
   */
  attributes?: Attributes;

  /**
   * Should this span be added to the root span or add as child
   */
  ignoreParentSpan?: boolean;

  /**
   * Type of span this represents. Default: SpanKind.Internal
   */
  kind?: SpanKind;
}

/**
 * caches the result of a decorated method.
 */
export function instrument<T>({
  name,
  attributes,
  ignoreParentSpan,
  kind,
}: SpanParameters): Decorator<T> {
  return decorate(async ({ callback }) => {
    const tracer = getTracer();
    return await tracer.startActiveSpan(
      name,
      {
        attributes,
        root: ignoreParentSpan,
        kind,
      },
      async (span) => {
        const result = await callback();
        span.end();
        return result;
      }
    );
  });
}
