import addrs from 'email-addresses';
import { logger } from '../../logger';

export interface GitAuthor {
  name?: string;
  address?: string;
}

export function parseGitAuthor(input: string): GitAuthor | null {
  let result: GitAuthor = null;
  if (!input) {
    return null;
  }
  try {
    result = addrs.parseOneAddress(input);
    if (result) {
      return result;
    }
    if (input.includes('[bot]@')) {
      // invalid github app/bot addresses
      const parsed = addrs.parseOneAddress(
        input.replace('[bot]@', '@')
      ) as addrs.ParsedMailbox;
      if (parsed?.address) {
        result = {
          name: parsed.name || input.replace(/@.*/, ''),
          address: parsed.address.replace('@', '[bot]@'),
        };
        return result;
      }
    }
    if (input.includes('<') && input.includes('>')) {
      // try wrapping the name part in quotations
      result = addrs.parseOneAddress('"' + input.replace(/(\s?<)/, '"$1'));
      if (result) {
        return result;
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'Unknown error parsing gitAuthor');
  }
  // give up
  return null;
}
