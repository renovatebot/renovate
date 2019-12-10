import is from '@sindresorhus/is';
import ini from 'ini';
import isBase64 from 'validator/lib/isBase64';
import { logger } from '../../logger';

let npmrc: Record<string, any> | null = null;
let npmrcRaw: string;

export function getNpmrc(): Record<string, any> | null {
  return npmrc;
}

function envReplace(value: any, env = process.env): any {
  // istanbul ignore if
  if (!is.string(value)) {
    return value;
  }

  const ENV_EXPR = /(\\*)\$\{([^}]+)\}/g;

  return value.replace(ENV_EXPR, (match, esc, envVarName) => {
    if (env[envVarName] === undefined) {
      logger.warn('Failed to replace env in config: ' + match);
      throw new Error('env-replace');
    }
    return env[envVarName];
  });
}

export function setNpmrc(input?: string): void {
  if (input) {
    if (input === npmrcRaw) {
      return;
    }
    const existingNpmrc = npmrc;
    npmrcRaw = input;
    logger.debug('Setting npmrc');
    npmrc = ini.parse(input.replace(/\\n/g, '\n'));
    // massage _auth to _authToken
    for (const [key, val] of Object.entries(npmrc)) {
      // istanbul ignore if
      if (
        global.trustLevel !== 'high' &&
        key.endsWith('registry') &&
        val &&
        val.includes('localhost')
      ) {
        logger.info(
          { key, val },
          'Detected localhost registry - rejecting npmrc file'
        );
        npmrc = existingNpmrc;
        return;
      }
      if (key !== '_auth' && key.endsWith('_auth') && isBase64(val)) {
        logger.debug('Massaging _auth to _authToken');
        npmrc[key + 'Token'] = val;
        npmrc.massagedAuth = true;
        delete npmrc[key];
      }
    }
    if (global.trustLevel !== 'high') {
      return;
    }
    for (const key in npmrc) {
      if (Object.prototype.hasOwnProperty.call(npmrc, key)) {
        npmrc[key] = envReplace(npmrc[key]);
      }
    }
  } else if (npmrc) {
    logger.debug('Resetting npmrc');
    npmrc = null;
    npmrcRaw = null;
  }
}
