import { isNonEmptyString } from '@sindresorhus/is';
import { createGlobalProxyAgent } from 'global-agent';
import { logger } from './logger/index.ts';
import { addSecretForSanitizing } from './util/sanitize.ts';
import { parseUrl } from './util/url.ts';

const envVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY'];
const proxyEnvVarsWithCredentials = ['HTTP_PROXY', 'HTTPS_PROXY'];

let agent = false;

function sanitizeProxyCredentials(envVar: string): void {
  const uri = parseUrl(process.env[envVar]);
  if (uri?.password) {
    addSecretForSanitizing(uri.password, 'global');
  }
}

export function bootstrap(): void {
  envVars.forEach((envVar) => {
    /* v8 ignore next -- env is case-insensitive on windows */
    if (
      typeof process.env[envVar] === 'undefined' &&
      typeof process.env[envVar.toLowerCase()] !== 'undefined'
    ) {
      process.env[envVar] = process.env[envVar.toLowerCase()];
    }

    if (process.env[envVar]) {
      logger.debug(`Detected ${envVar} value in env`);
      process.env[envVar.toLowerCase()] = process.env[envVar];
    }
  });

  proxyEnvVarsWithCredentials.forEach(sanitizeProxyCredentials);

  if (
    isNonEmptyString(process.env.HTTP_PROXY) ||
    isNonEmptyString(process.env.HTTPS_PROXY)
  ) {
    createGlobalProxyAgent({
      environmentVariableNamespace: '',
    });
    agent = true;
  } else {
    // for testing only, does not reset global agent
    agent = false;
  }
}

// will be used by our http layer later
export function hasProxy(): boolean {
  return agent === true;
}
