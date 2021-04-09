import { logger } from '../logger';

export function isSkipComment(comment?: string): boolean {
  if (/^(renovate|pyup):/.test(comment)) {
    const command = comment.split('#')[0].split(':')[1].trim();
    if (command === 'ignore') {
      return true;
    }
    logger.debug('Unknown comment command: ' + command);
  }
  return false;
}
