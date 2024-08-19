import { SpanKind } from '@opentelemetry/api';
import type { SpanParameters } from './types';
import { instrument as instrumentFunc } from '.';

type Method<This, Args extends any[], Return> = (
  this: This,
  ...args: Args
) => Return;

type Context<This, Args extends any[], Return> = ClassMethodDecoratorContext<
  This,
  Method<This, Args, Return>
>;

/**
 * instruments a decorated method.
 */
export function instrument<This, Args extends any[], Return>({
  name,
  attributes,
  ignoreParentSpan,
  kind = SpanKind.INTERNAL,
}: SpanParameters) {
  return function decorator(
    target: Method<This, Args, Return>,
    _context: Context<This, Args, Return>,
  ) {
    return function decorated(this: This, ...args: Args) {
      const callback = (): Return => target.apply(this, args);
      return instrumentFunc(name, callback, {
        attributes,
        root: ignoreParentSpan,
        kind,
      });
    };
  };
}
