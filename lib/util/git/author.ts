import addrs from 'email-addresses';
import { logger } from '../../logger';
import { regEx } from '../regex';
import type { GitAuthor } from './types';

export function parseGitAuthor(input: string): GitAuthor | null {
  let result: GitAuthor | null = null;
  if (!input) {
    return null;
  }
  try {
    result = addrs.parseOneAddress(input);
    if (result) {
      return result;
    }
    let massagedInput: string | undefined;
    let massagedBotEmail = false;
    if (input.includes('<') && input.includes('>')) {
      // try wrapping the name part in quotations
      massagedInput = '"' + input.replace(regEx(/(\s?<)/), '"$1');
    }
    if (input.includes('[bot]@')) {
      // invalid github app/bot addresses
      massagedInput = (massagedInput ?? input).replace('[bot]@', '@');
      massagedBotEmail = true;
    }
    if (!massagedInput) {
      return null;
    }
    const parsed = addrs.parseOneAddress(massagedInput) as addrs.ParsedMailbox;
    if (parsed?.address) {
      result = {
        name: parsed.name ?? input.replace(regEx(/@.*/), ''),
        address: parsed.address,
      };
      if (massagedBotEmail) {
        result.address = result.address?.replace('@', '[bot]@');
      }
      return result;
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'Unknown error parsing gitAuthor');
  }
  // give up
  return null;
}
