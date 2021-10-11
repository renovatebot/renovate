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
    let massagedInput;
    let massagedBotEmail = false;
    if (input.includes('<') && input.includes('>')) {
      // try wrapping the name part in quotations
      massagedInput = '"' + input.replace(/(\s?<)/, '"$1');
    }
    if (input.includes('[bot]@')) {
      // invalid github app/bot addresses
      massagedInput = (massagedInput || input).replace('[bot]@', '@');
      massagedBotEmail = true;
    }
    if (!massagedInput) {
      return null;
    }
    const parsed = addrs.parseOneAddress(massagedInput) as addrs.ParsedMailbox;
    if (parsed?.address) {
      result = {
        name: parsed.name || input.replace(/@.*/, ''),
        address: parsed.address,
      };
      if (massagedBotEmail) {
        result.address = result.address.replace('@', '[bot]@');
      }
      return result;
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'Unknown error parsing gitAuthor');
  }
  // give up
  return null;
}
