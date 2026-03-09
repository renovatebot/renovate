import type { SpanKind } from '@opentelemetry/api';
import { instrument } from './index.ts';
import type { RenovateSpanAttributes } from './types.ts';

interface InstrumentedOptions {
  /**
   * The name of the span.
   */
  name: string;

  /**
   * Attributes to add to the span.
   */
  attributes?: RenovateSpanAttributes;

  /**
   * When true, creates a root span instead of a child of the current span.
   * @default false
   */
  ignoreParentSpan?: boolean;

  /**
   * Type of span. Default: SpanKind.INTERNAL
   */
  kind?: SpanKind;
}

/**
 * Creates a wrapped version of an async function that instruments each call.
 *
 * @param options - Instrumentation options
 * @param fn - The async function to wrap
 * @returns A new function that instruments each call
 */
export function withInstrumenting<T, Args extends unknown[]>(
  options: InstrumentedOptions,
  fn: (...args: Args) => Promise<T>,
): (...args: Args) => Promise<T> {
  const { name, attributes, ignoreParentSpan, kind } = options;
  return (...args: Args): Promise<T> => {
    return instrument(name, () => fn(...args), {
      attributes,
      root: ignoreParentSpan,
      kind,
    });
  };
}
