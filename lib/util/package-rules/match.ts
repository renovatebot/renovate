import { minimatch } from 'minimatch';
import { logger } from '../../logger';
import { regEx } from '../regex';

export function matchRegexOrMinimatch(pattern: string, input: string): boolean {
  if (pattern.length > 2 && pattern.startsWith('/') && pattern.endsWith('/')) {
    try {
      const regex = regEx(pattern.slice(1, -1));
      return regex.test(input);
    } catch (err) {
      logger.once.warn({ err, pattern }, 'Invalid regex pattern');
      return false;
    }
  }
  return minimatch(input, pattern, { dot: true });
}

export function anyMatchRegexOrMinimatch(
  patterns: string[],
  input: string
): boolean {
  return patterns.some((pattern) => matchRegexOrMinimatch(pattern, input));
}
