import JSON5 from 'json5';
import type { JsonValue } from 'type-fest';
import { z } from 'zod';

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
    xs.filter((x): x is Elem => x !== null)
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
        if (rec[key] === null) {
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

export const Json = z.string().transform((str, ctx): JsonValue => {
  try {
    return JSON.parse(str);
  } catch (e) {
    ctx.addIssue({ code: 'custom', message: 'Invalid JSON' });
    return z.NEVER;
  }
});
type Json = z.infer<typeof Json>;

export const Json5 = z.string().transform((str, ctx): JsonValue => {
  try {
    return JSON5.parse(str);
  } catch (e) {
    ctx.addIssue({ code: 'custom', message: 'Invalid JSON5' });
    return z.NEVER;
  }
});
