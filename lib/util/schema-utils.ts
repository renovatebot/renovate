import { z } from 'zod';

interface ErrorContext<T> {
  error: z.ZodError;
  input: T;
}

export function LooseArray<Schema extends z.ZodTypeAny>(
  Elem: Schema,
  onError?: (err: ErrorContext<unknown[]>) => void
): z.ZodEffects<z.ZodArray<z.ZodAny, 'many'>, z.TypeOf<Schema>[], any[]> {
  if (!onError) {
    // Avoid error-related computations inside the loop
    return z.array(z.any()).transform((input) => {
      const output: z.infer<Schema>[] = [];
      for (const x of input) {
        const parsed = Elem.safeParse(x);
        if (parsed.success) {
          output.push(parsed.data);
        }
      }
      return output;
    });
  }

  return z.array(z.any()).transform((input) => {
    const output: z.infer<Schema>[] = [];
    const issues: z.ZodIssue[] = [];

    for (let idx = 0; idx < input.length; idx += 1) {
      const x = input[idx];
      const parsed = Elem.safeParse(x);

      if (parsed.success) {
        output.push(parsed.data);
        continue;
      }

      for (const issue of parsed.error.issues) {
        issue.path.unshift(idx);
        issues.push(issue);
      }
    }

    if (issues.length) {
      const error = new z.ZodError(issues);
      onError({ error, input });
    }

    return output;
  });
}

export function LooseRecord<Schema extends z.ZodTypeAny>(
  Elem: Schema,
  onError?: (ctx: ErrorContext<Record<string, unknown>>) => void
): z.ZodEffects<
  z.ZodRecord<z.ZodString, z.ZodAny>,
  Record<string, z.TypeOf<Schema>>,
  Record<string, any>
> {
  if (!onError) {
    // Avoid error-related computations inside the loop
    return z.record(z.any()).transform((input) => {
      const output: Record<string, z.infer<Schema>> = {};
      for (const [key, val] of Object.entries(input)) {
        const parsed = Elem.safeParse(val);
        if (parsed.success) {
          output[key] = parsed.data;
        }
      }
      return output;
    });
  }

  return z.record(z.any()).transform((input) => {
    const output: Record<string, z.infer<Schema>> = {};
    const issues: z.ZodIssue[] = [];

    for (const [key, val] of Object.entries(input)) {
      const parsed = Elem.safeParse(val);

      if (parsed.success) {
        output[key] = parsed.data;
        continue;
      }

      for (const issue of parsed.error.issues) {
        issue.path.unshift(key);
        issues.push(issue);
      }
    }

    if (issues.length) {
      const error = new z.ZodError(issues);
      onError({ error, input });
    }

    return output;
  });
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
