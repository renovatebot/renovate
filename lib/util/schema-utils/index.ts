import ini from 'ini';
import JSON5 from 'json5';
import { DateTime } from 'luxon';
import type { JsonArray } from 'type-fest';
import { z } from 'zod/v4';
import { logger } from '../../logger/index.ts';
import type { PackageDependency } from '../../modules/manager/types.ts';
import { parseJsonc } from '../common.ts';
import { parse as parseToml } from '../toml.ts';
import type { YamlOptions } from '../yaml.ts';
import { parseSingleYaml, parseYaml } from '../yaml.ts';

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
  { onError }: LooseOpts<unknown[]> = {},
): z.ZodType<z.TypeOf<Schema>[], any> {
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
        issues.push({ ...issue, path: [idx, ...issue.path] });
      }
    }

    if (issues.length) {
      const error = new z.ZodError(issues);
      onError({ error, input });
    }

    return output;
  });
}

type LooseRecordResult<ValueSchema extends z.ZodTypeAny> = z.ZodType<
  Record<string, z.TypeOf<ValueSchema>>,
  any
>;

type LooseRecordOpts = LooseOpts<Record<string, unknown>>;

/**
 * Works like `z.record()`, but drops wrong elements instead of invalidating the whole record.
 *
 * **Important**: non-record inputs other are still invalid.
 * Use `LooseRecord(...).catch({})` to handle it.
 *
 * @param KeyValue Schema for record keys
 * @param ValueValue Schema for record values
 * @param onError Callback for errors
 * @returns Schema for record
 */
export function LooseRecord<ValueSchema extends z.ZodTypeAny>(
  Value: ValueSchema,
): LooseRecordResult<ValueSchema>;
export function LooseRecord<
  KeySchema extends z.ZodTypeAny,
  ValueSchema extends z.ZodTypeAny,
>(Key: KeySchema, Value: ValueSchema): LooseRecordResult<ValueSchema>;
export function LooseRecord<ValueSchema extends z.ZodTypeAny>(
  Value: ValueSchema,
  { onError }: LooseRecordOpts,
): LooseRecordResult<ValueSchema>;
export function LooseRecord<
  KeySchema extends z.ZodTypeAny,
  ValueSchema extends z.ZodTypeAny,
>(
  Key: KeySchema,
  Value: ValueSchema,
  { onError }: LooseRecordOpts,
): LooseRecordResult<ValueSchema>;
export function LooseRecord<
  KeySchema extends z.ZodTypeAny,
  ValueSchema extends z.ZodTypeAny,
>(
  arg1: ValueSchema | KeySchema,
  arg2?: ValueSchema | LooseOpts<Record<string, unknown>>,
  arg3?: LooseRecordOpts,
): LooseRecordResult<ValueSchema> {
  let Key: z.ZodType = z.any();
  let Value: ValueSchema;
  let opts: LooseRecordOpts = {};
  if (arg2 && arg3) {
    Key = arg1 as KeySchema;
    Value = arg2 as ValueSchema;
    opts = arg3;
  } else if (arg2) {
    if (arg2 instanceof z.ZodType) {
      Key = arg1 as KeySchema;
      Value = arg2;
    } else {
      Value = arg1 as ValueSchema;
      opts = arg2;
    }
  } else {
    Value = arg1 as ValueSchema;
  }

  const { onError } = opts;
  if (!onError) {
    // Avoid error-related computations inside the loop
    return z.record(z.string(), z.any()).transform((input) => {
      const output: Record<string, z.infer<ValueSchema>> = {};
      for (const [inputKey, inputVal] of Object.entries(input)) {
        const parsedKey = Key.safeParse(inputKey);
        const parsedValue = Value.safeParse(inputVal);
        if (parsedKey.success && parsedValue.success) {
          output[parsedKey.data as string] = parsedValue.data;
        }
      }
      return output;
    });
  }

  return z.record(z.string(), z.any()).transform((input) => {
    const output: Record<string, z.infer<ValueSchema>> = {};
    const issues: z.ZodIssue[] = [];

    for (const [inputKey, inputVal] of Object.entries(input)) {
      const parsedKey = Key.safeParse(inputKey);
      if (!parsedKey.success) {
        for (const issue of parsedKey.error.issues) {
          issues.push({ ...issue, path: [inputKey, ...issue.path] });
        }
        continue;
      }

      const parsedValue = Value.safeParse(inputVal);
      if (!parsedValue.success) {
        for (const issue of parsedValue.error.issues) {
          issues.push({ ...issue, path: [inputKey, ...issue.path] });
        }
        continue;
      }

      output[parsedKey.data as string] = parsedValue.data;
    }

    if (issues.length) {
      const error = new z.ZodError(issues);
      onError({ error, input });
    }

    return output;
  });
}

export const Json = z.string().transform((str, ctx): unknown => {
  try {
    return JSON.parse(str);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid JSON' });
    return z.NEVER;
  }
});

export const Json5 = z.string().transform((str, ctx): unknown => {
  try {
    return JSON5.parse(str);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid JSON5' });
    return z.NEVER;
  }
});

export const Jsonc = z.string().transform((str, ctx): unknown => {
  try {
    return parseJsonc(str);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid JSONC' });
    return z.NEVER;
  }
});

export const UtcDate = z
  .string()
  .describe('ISO 8601 string')
  .transform((str, ctx): DateTime => {
    const date = DateTime.fromISO(str, { zone: 'utc' });
    if (!date.isValid) {
      ctx.addIssue({ code: 'custom', message: 'Invalid date' });
      return z.NEVER;
    }
    return date;
  });

export const Yaml = z.string().transform((str, ctx): unknown => {
  try {
    return parseSingleYaml(str);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid YAML' });
    return z.NEVER;
  }
});

export const MultidocYaml = z.string().transform((str, ctx): unknown => {
  try {
    return parseYaml(str);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid YAML' });
    return z.NEVER;
  }
});

export function multidocYaml(
  opts?: Omit<YamlOptions, 'customSchema'>,
): z.ZodType<JsonArray> {
  return z.string().transform((str, ctx): JsonArray => {
    try {
      return parseYaml(str, opts) as JsonArray;
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Invalid YAML' });
      return z.NEVER;
    }
  });
}

export const Toml = z.string().transform((str, ctx) => {
  try {
    return parseToml(str);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid TOML' });
    return z.NEVER;
  }
});

export const Ini = z.string().transform((str, ctx): Record<string, unknown> => {
  try {
    return ini.parse(str);
  } catch /* v8 ignore next -- TODO: add test #40625 */ {
    ctx.addIssue({ code: 'custom', message: 'Invalid INI' });
    return z.NEVER;
  }
});

export function withDepType<
  Output extends PackageDependency[],
  Schema extends z.ZodType<Output>,
>(schema: Schema, depType: string, force = true): z.ZodType<Output> {
  return schema.transform((deps) => {
    for (const dep of deps) {
      if (!dep.depType || force) {
        dep.depType = depType;
      }
    }
    return deps;
  });
}

export function withDebugMessage<Output>(
  value: Output,
  msg: string,
): (ctx: { error: unknown; input: unknown }) => Output {
  return ({ error: err }) => {
    logger.debug({ err }, msg);
    return value;
  };
}

export function withTraceMessage<Output>(
  value: Output,
  msg: string,
): (ctx: { error: unknown; input: unknown }) => Output {
  return ({ error: err }) => {
    logger.trace({ err }, msg);
    return value;
  };
}

function isCircular(value: unknown, visited = new Set<unknown>()): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  if (visited.has(value)) {
    return true;
  }

  const downstreamVisited = new Set(visited);
  downstreamVisited.add(value);

  if (Array.isArray(value)) {
    for (const childValue of value) {
      if (isCircular(childValue, downstreamVisited)) {
        return true;
      }
    }

    return false;
  }

  const values = Object.values(value);
  for (const ov of values) {
    if (isCircular(ov, downstreamVisited)) {
      return true;
    }
  }

  return false;
}

export const NotCircular = z.unknown().superRefine((val, ctx) => {
  if (isCircular(val)) {
    ctx.addIssue({
      code: 'custom',
      message: 'values cannot be circular data structures',
      fatal: true,
    });

    return z.NEVER;
  }
});

export const EmailAddress = z.email();
export type EmailAddress = z.infer<typeof EmailAddress>;

export function isEmailAdress(value: string): boolean {
  return EmailAddress.safeParse(value).success;
}
