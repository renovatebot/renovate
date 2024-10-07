import jsonata from 'jsonata';
import * as memCache from './cache/memory';

export function getExpression(input: string): jsonata.Expression | Error {
  const cacheKey = `jsonata:${input}`;
  const cachedExpression = memCache.get(cacheKey);
  if (cachedExpression) {
    return cachedExpression;
  }
  let result: jsonata.Expression | Error;
  try {
    result = jsonata(input);
  } catch (err) {
    // JSONata errors aren't detected as TypeOf Error
    result = new Error(err.message ?? 'Unknown JSONata error');
  }
  memCache.set(cacheKey, result);
  return result;
}
