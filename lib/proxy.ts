import http from 'node:http';
import { isNonEmptyString } from '@sindresorhus/is';
import { logger } from './logger/index.ts';

const envVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY'];

const proxyVars = new Set(
  ['HTTP_PROXY', 'HTTPS_PROXY'].flatMap((envVar) => [
    envVar,
    envVar.toLowerCase(),
  ]),
);

let agent = false;

// augment node:http to add setGlobalProxyFromEnv method (requires Node.js v24.14.0+ )
// https://nodejs.org/docs/latest-v24.x/api/http.html#httpsetglobalproxyfromenvproxyenv
declare module 'node:http' {
  function setGlobalProxyFromEnv(): void;
}

export async function bootstrap(): Promise<void> {
  const envValues = Object.entries(process.env).filter(
    ([key, val]) => proxyVars.has(key) && isNonEmptyString(val),
  );
  if (envValues.length) {
    for (const [envVar] of envValues) {
      logger.debug(`Detected ${envVar} value in env`);
    }
  } else {
    // no proxy detected
    // for testing only, does not reset global agent
    agent = false;
    return;
  }

  // TODO: simplify when we require Node.js v24.14.0+ and can rely on built-in proxy support.
  const useGlobalAgent = process.env.RENOVATE_X_GLOBAL_AGENT === 'true';
  const hasBuiltInProxy = 'setGlobalProxyFromEnv' in http;
  // v8 ignore if -- hard to test
  if (!useGlobalAgent && !hasBuiltInProxy) {
    logger.warn(
      'Node.js built-in proxy support is not available in this version of Node.js (requires v24.14.0+). Falling back to global-agent.',
    );
  }

  if (!hasBuiltInProxy || useGlobalAgent) {
    envVars.forEach((envVar) => {
      /* v8 ignore next -- env is case-insensitive on windows */
      if (
        typeof process.env[envVar] === 'undefined' &&
        typeof process.env[envVar.toLowerCase()] !== 'undefined'
      ) {
        process.env[envVar] = process.env[envVar.toLowerCase()];
      }

      if (process.env[envVar]) {
        process.env[envVar.toLowerCase()] = process.env[envVar];
      }
    });

    const ga = await import('global-agent');
    ga.createGlobalProxyAgent({
      environmentVariableNamespace: '',
    });
  } else {
    http.setGlobalProxyFromEnv();
  }
  agent = true;
}

// will be used by our http layer later
export function hasProxy(): boolean {
  return agent === true;
}
