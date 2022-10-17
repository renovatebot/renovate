import hasha from 'hasha';
import type { z } from 'zod';
import { logger } from '../logger';
import * as memCache from './cache/memory';
import { safeStringify } from './stringify';

type SchemaErrorsMap = Record<string, Record<string, z.ZodError>>;

function getCacheKey(error: z.ZodError): string {
  const content = safeStringify(error);
  const key = hasha(content).slice(0, 32);
  return `err_${key}`;
}

function collectError<T extends z.ZodSchema>(
  schema: T,
  error: z.ZodError
): void {
  const { description = 'Unspecified schema' } = schema;
  const schemaErrorsMap = memCache.get<SchemaErrorsMap>('schema-errors') ?? {};
  const schemaErrors = schemaErrorsMap[description] ?? {};
  const key = getCacheKey(error);
  const schemaError = schemaErrors[key];
  if (!schemaError) {
    schemaErrors[key] = error;
    schemaErrorsMap[description] = schemaErrors;
  }
  memCache.set('schema-errors', schemaErrorsMap);
}

export function reportErrors(): void {
  const schemaErrorsMap = memCache.get<SchemaErrorsMap>('schema-errors');
  if (!schemaErrorsMap) {
    return;
  }

  for (const [description, schemaErrors] of Object.entries(schemaErrorsMap)) {
    const errors = Object.values(schemaErrors);
    for (const err of errors) {
      logger.warn({ description, err }, `Schema validation error`);
    }
  }

  memCache.set('schema-errors', null);
}

export function match<T extends z.ZodSchema>(
  schema: T,
  input: unknown,
  onError?: 'warn' | 'throw'
): input is z.infer<T> {
  const res = schema.safeParse(input);
  const { success } = res;
  if (!success) {
    if (onError === 'warn') {
      collectError(schema, res.error);
    }

    if (onError === 'throw') {
      throw res.error;
    }

    return false;
  }

  return true;
}
