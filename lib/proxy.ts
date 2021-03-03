import is from '@sindresorhus/is';

const envVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY'];

let agent = false;

export function bootstrap(): void {
  /* c8 ignore start */
  /* env is case-insensitive on windows */
  envVars.forEach((envVar) => {
    if (
      typeof process.env[envVar] === 'undefined' &&
      typeof process.env[envVar.toLowerCase()] !== 'undefined'
    ) {
      process.env[envVar] = process.env[envVar.toLowerCase()];
    }
  });
  /* c8 ignore stop */

  if (
    is.nonEmptyString(process.env.HTTP_PROXY) ||
    is.nonEmptyString(process.env.HTTPS_PROXY)
  ) {
    // eslint-disable-next-line
    const { createGlobalProxyAgent } = require('global-agent');
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
