import is from '@sindresorhus/is';
import ini from 'ini';
import { logger } from '../../logger';
import { add } from '../../util/sanitize';

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

const envRe = /(\\*)\$\{([^}]+)\}/;
// TODO: better add to host rules
function sanitize(key: string, val: string): void {
  if (!val || envRe.test(val)) {
    return;
  }
  if (key.endsWith('_authToken') || key.endsWith('_auth')) {
    add(val);
  } else if (key.endsWith(':_password')) {
    add(val);
    const password = Buffer.from(val, 'base64').toString();
    add(password);
    const username: string = npmrc[key.replace(':_password', ':username')];
    add(Buffer.from(`${username}:${password}`).toString('base64'));
  }
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
    for (const [key, val] of Object.entries(npmrc)) {
      if (global.trustLevel !== 'high') {
        sanitize(key, val);
      }
      if (
        global.trustLevel !== 'high' &&
        key.endsWith('registry') &&
        val &&
        val.includes('localhost')
      ) {
        logger.debug(
          { key, val },
          'Detected localhost registry - rejecting npmrc file'
        );
        npmrc = existingNpmrc;
        return;
      }
    }
    if (global.trustLevel !== 'high') {
      return;
    }
    for (const key of Object.keys(npmrc)) {
      npmrc[key] = envReplace(npmrc[key]);
      sanitize(key, npmrc[key]);
    }
  } else if (npmrc) {
    logger.debug('Resetting npmrc');
    npmrc = null;
    npmrcRaw = null;
  }
}
