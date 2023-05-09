import JSON5 from 'json5';
import type { JsonValue } from 'type-fest';
import { z } from 'zod';

interface ErrorContext<T> {
  error: z.ZodError;
  input: T;
}

interface LooseOpts<T> {
  onError?: (err: ErrorContext<T>) => void;
}

/**
 * Works like `z.array()`, but drops wrong elements instead of invalidating the whole array.
 *
 * **Important**: non-array inputs are still invalid.
 * Use `LooseArray(...).catch([])` to handle it.
 *
 * @param Elem Schema for array elements
 * @param onError Callback for errors
 * @returns Schema for array
 */
export function LooseArray<Schema extends z.ZodTypeAny>(
  Elem: Schema,
  { onError }: LooseOpts<unknown[]> = {}
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

/**
 * Works like `z.record()`, but drops wrong elements instead of invalidating the whole record.
 *
 * **Important**: non-record inputs other are still invalid.
 * Use `LooseRecord(...).catch({})` to handle it.
 *
 * @param Elem Schema for record values
 * @param onError Callback for errors
 * @returns Schema for record
 */
export function LooseRecord<Schema extends z.ZodTypeAny>(
  Elem: Schema,
  { onError }: LooseOpts<Record<string, unknown>> = {}
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
