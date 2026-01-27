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
 * Wraps an async function in an OpenTelemetry span.
 *
 * @param options - Instrumentation options
 * @param fn - The async function to instrument
 * @returns The result of the function
 */
export function instrumented<T>(
  options: InstrumentedOptions,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  const { name, attributes, ignoreParentSpan, kind } = options;
  return instrument(name, fn, {
    attributes,
    root: ignoreParentSpan,
    kind,
  });
}
