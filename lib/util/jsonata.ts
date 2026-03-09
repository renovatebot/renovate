import jsonata from 'jsonata';
import * as memCache from './cache/memory/index.ts';
import { toSha256 } from './hash.ts';

export interface JsonataExpression {
  evaluate(data: unknown, bindings?: Record<string, unknown>): Promise<unknown>;
}

export function getExpression(input: string): JsonataExpression | Error {
  const cacheKey = `jsonata:${toSha256(input)}`;
  const cachedExpression = memCache.get<jsonata.Expression | Error>(cacheKey);
  // istanbul ignore if: cannot test
  if (cachedExpression) {
    return cachedExpression;
  }
  let result: jsonata.Expression | Error;
  try {
    const expression = jsonata(input);
    // Wrap the evaluate method to default bindings to {} for concurrent evaluation safety.
    // This prevents race conditions when the same cached expression is evaluated
    // concurrently with different data. See #40311 for background.
    const originalEvaluate = expression.evaluate.bind(expression);
    expression.evaluate = (
      data: unknown,
      bindings: Record<string, unknown> = {},
    ) => {
      return originalEvaluate(data, bindings);
    };
    result = expression;
  } catch (err) {
    // JSONata errors aren't detected as TypeOf Error
    result = new Error(err.message);
  }
  memCache.set(cacheKey, result);
  return result;
}
