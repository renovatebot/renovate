import { logger } from '../logger';
import { regEx } from './regex';

export function isSkipComment(comment?: string): boolean {
  if (regEx(/^(renovate|pyup):/).test(comment)) {
    // TODO #12070 #12071 needs to be checked manually
    const command = comment.split('#')[0].split(':')[1].trim();
    if (command === 'ignore') {
      return true;
    }
    logger.debug('Unknown comment command: ' + command);
  }
  return false;
}
