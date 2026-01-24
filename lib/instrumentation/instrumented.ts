import type { SpanKind } from '@opentelemetry/api';
import type { RenovateSpanAttributes } from './types';
import { instrument } from '.';

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
  fn: () => Promise<T>,
): Promise<T> {
  const { name, attributes, ignoreParentSpan, kind } = options;
  return instrument(name, fn, {
    attributes,
    root: ignoreParentSpan,
    kind,
  });
}
