import { logger } from '../logger';

export interface RegExConstructor {
  new (pattern: RegExp | string): RegExp;
  new (pattern: string, flags?: string): RegExp;
}

const RegEx: RegExConstructor = (() => {
  try {
    // eslint-disable-next-line
    const RE2 = require('re2');
    // Test if native is working
    new RE2('.*').exec('test');
    logger.debug('Using RE2 as regex engine');
    return RE2;
  } catch (err) {
    logger.warn({ err }, 'RE2 not usable, falling back to RegExp');
    return RegExp;
  }
})();

export { RegEx };
