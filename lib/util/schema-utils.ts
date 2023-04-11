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

export function parseJson<
  T = unknown,
  Schema extends z.ZodType<T> = z.ZodType<T>
>(input: string, schema: Schema): z.infer<Schema> {
  const parsed = JSON.parse(input);
  return schema.parse(parsed);
}

export function safeParseJson<
  T = unknown,
  Schema extends z.ZodType<T> = z.ZodType<T>
>(
  input: string,
  schema: Schema,
  catchCallback?: (e: SyntaxError | z.ZodError) => void
): z.infer<Schema> | null {
  try {
    return parseJson(input, schema);
  } catch (err) {
    catchCallback?.(err);
    return null;
  }
}
