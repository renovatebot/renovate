import { logger } from '../logger';

export function safeParseJson(input: string): any {
  try {
    return JSON.parse(input);
  } catch (err) {
    logger.trace({ err }, 'Error parsing JSON');
    return null;
  }
}
