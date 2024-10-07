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
    result = err;
  }
  memCache.set(cacheKey, result);
  return result;
}
