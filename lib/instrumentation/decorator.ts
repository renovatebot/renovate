import { SpanKind } from '@opentelemetry/api';
import type { Decorator } from '../util/decorator/index.ts';
import { decorate } from '../util/decorator/index.ts';
import { instrumented } from './instrumented.ts';
import type { SpanParameters } from './types.ts';

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
    return await instrumented(
      { name, attributes, ignoreParentSpan, kind },
      callback,
    );
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
  return (async (...args: any[]) => {
    return await instrumented(
      { name, attributes, ignoreParentSpan, kind },
      () => fn(...args),
    );
  }) as T;
}
