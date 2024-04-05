import { SpanKind } from '@opentelemetry/api';
import { Decorator, decorate } from '../util/decorator';
import type { SpanParameters } from './types';
import { instrument as instrumentFunc } from '.';

/**
 * instruments a decorated method.
 */
export function instrument<T>({
  name,
  attributes,
  ignoreParentSpan,
  kind = SpanKind.INTERNAL,
}: SpanParameters): Decorator<T> {
  return decorate(async ({ callback }) => {
    return await instrumentFunc(name, callback, {
      attributes,
      root: ignoreParentSpan,
      kind,
    });
  });
}
