import type { Attributes, SpanKind } from '@opentelemetry/api';
import { Decorator, decorate } from '../util/decorator';
import { instrument as instrumentFunc } from '.';

/**
 * The instrumentation decorator parameters.
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
   * Should this span be added to the root span or to the current active span
   */
  ignoreParentSpan?: boolean;

  /**
   * Type of span this represents. Default: SpanKind.Internal
   */
  kind?: SpanKind;
}

/**
 * instruments a decorated method.
 */
export function instrument<T>({
  name,
  attributes,
  ignoreParentSpan,
  kind,
}: SpanParameters): Decorator<T> {
  return decorate(async ({ callback }) => {
    return await instrumentFunc(name, async () => await callback(), {
      attributes,
      root: ignoreParentSpan,
      kind,
    });
  });
}
