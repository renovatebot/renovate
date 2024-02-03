import { logger } from '../../logger';
import { minimatch } from '../minimatch';
import { regEx } from '../regex';

export function matchRegexOrMinimatch(input: string, pattern: string): boolean {
  if (pattern.length > 2 && pattern.startsWith('/') && pattern.endsWith('/')) {
    try {
      const regex = regEx(pattern.slice(1, -1));
      return regex.test(input);
    } catch (err) {
      logger.once.warn({ err, pattern }, 'Invalid regex pattern');
      return false;
    }
  }

  return minimatch(pattern, { dot: true }).match(input);
}

export function anyMatchRegexOrMinimatch(
  input: string,
  patterns: string[],
): boolean | null {
  return patterns.some((pattern) => matchRegexOrMinimatch(input, pattern));
}
