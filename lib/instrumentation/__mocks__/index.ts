import { NoopTracer } from '@opentelemetry/api/build/src/trace/NoopTracer';
import { NoopTracerProvider } from '@opentelemetry/api/build/src/trace/NoopTracerProvider';

export const getTracerProvider = jest.fn(args => new NoopTracerProvider());
export const getTracer = jest.fn(args => new NoopTracer());
