import is from '@sindresorhus/is';
import hasha from 'hasha';
import { z } from 'zod';
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

export function looseArray<T extends z.ZodTypeAny>(
  schema: T,
  catchCallback?: () => void
): z.ZodEffects<
  z.ZodCatch<z.ZodArray<z.ZodCatch<z.ZodNullable<T>>, 'many'>>,
  z.TypeOf<T>[],
  unknown
> {
  type Elem = z.infer<T>;

  const nullableSchema = schema.nullable().catch(
    catchCallback
      ? () => {
          catchCallback();
          return null;
        }
      : null
  );

  const arrayOfNullables = z.array(nullableSchema);

  const arrayWithFallback = catchCallback
    ? arrayOfNullables.catch(() => {
        catchCallback();
        return [];
      })
    : arrayOfNullables.catch([]);

  const filteredArray = arrayWithFallback.transform((xs) =>
    xs.filter((x): x is Elem => !is.null_(x))
  );

  return filteredArray;
}

export function looseRecord<T extends z.ZodTypeAny>(
  schema: T,
  catchCallback?: () => void
): z.ZodEffects<
  z.ZodCatch<z.ZodRecord<z.ZodString, z.ZodCatch<z.ZodNullable<T>>>>,
  Record<string, z.TypeOf<T>>,
  unknown
> {
  type Elem = z.infer<T>;

  const nullableSchema = schema.nullable().catch(
    catchCallback
      ? () => {
          catchCallback();
          return null;
        }
      : null
  );

  const recordOfNullables = z.record(nullableSchema);

  const recordWithFallback = catchCallback
    ? recordOfNullables.catch(() => {
        catchCallback();
        return {};
      })
    : recordOfNullables.catch({});

  const filteredRecord = recordWithFallback.transform(
    (rec): Record<string, Elem> => {
      for (const key of Object.keys(rec)) {
        if (is.null_(rec[key])) {
          delete rec[key];
        }
      }
      return rec;
    }
  );

  return filteredRecord;
}

export function looseValue<T, U extends z.ZodTypeDef, V>(
  schema: z.ZodType<T, U, V>,
  catchCallback?: () => void
): z.ZodCatch<z.ZodNullable<z.ZodType<T, U, V>>> {
  const nullableSchema = schema.nullable();
  const schemaWithFallback = catchCallback
    ? nullableSchema.catch(() => {
        catchCallback();
        return null;
      })
    : nullableSchema.catch(null);
  return schemaWithFallback;
}

export function looseObject<T extends z.ZodRawShape>(
  shape: T
): z.ZodObject<{
  [k in keyof T]: z.ZodOptional<z.ZodCatch<z.ZodNullable<T[k]>>>;
}> {
  const newShape: Record<keyof T, z.ZodTypeAny> = { ...shape };
  const keys: (keyof T)[] = Object.keys(shape);
  for (const k of keys) {
    const v = looseValue(shape[k]);
    newShape[k] = v;
  }

  return z.object(newShape).partial() as never;
}
