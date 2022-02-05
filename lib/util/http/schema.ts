import { ZodError, ZodIssue } from 'zod';
import { SCHEMA_ERROR } from '../../constants/error-messages';

export interface Schema<Output> {
  parse(input: unknown): Output;
}

export interface HttpSchema<Req, Resp> {
  request?: Schema<Req>;
  response?: Schema<Resp>;
}

class SchemaError extends Error {
  issues: ZodIssue[];

  constructor(err: ZodError) {
    super(SCHEMA_ERROR);
    this.issues = err.issues;
  }
}

export function coerceSchemaError<E extends Error>(err: E): E | SchemaError {
  return err instanceof ZodError ? new SchemaError(err) : err;
}

export function handleSchemaError<E extends Error>(err: E): never {
  throw coerceSchemaError(err);
}
