import { SpanKind } from '@opentelemetry/api';
import type { Decorator } from '../util/decorator';
import { decorate } from '../util/decorator';
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

export function instrumentStandalone<T extends (...args: any[]) => any>(
  {
    name,
    attributes,
    ignoreParentSpan,
    kind = SpanKind.INTERNAL,
  }: SpanParameters,
  fn: T,
): T {
  return async function (...args: any[]) {
    return await instrumentFunc(name, () => fn(...args), {
      attributes,
      root: ignoreParentSpan,
      kind,
    });
  } as T;
}
