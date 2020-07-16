import is from '@sindresorhus/is';
import {
  ProxyAgentConfigurationType,
  createGlobalProxyAgent,
} from 'global-agent';

const envVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY'];

let agent: ProxyAgentConfigurationType | undefined;

export function bootstrap(): ProxyAgentConfigurationType | undefined {
  envVars.forEach((envVar) => {
    /* istanbul ignore if: env is case-insensitive on windows */
    if (
      typeof process.env[envVar] === 'undefined' &&
      typeof process.env[envVar.toLowerCase()] !== 'undefined'
    ) {
      process.env[envVar] = process.env[envVar.toLowerCase()];
    }
  });

  if (
    is.nonEmptyString(process.env.HTTP_PROXY) ||
    is.nonEmptyString(process.env.HTTPS_PROXY)
  ) {
    agent = createGlobalProxyAgent({
      environmentVariableNamespace: '',
    });
  } else {
    agent = undefined;
  }

  return agent;
}

// will be used by our http layer later
export function hasProxy(): boolean {
  return agent !== undefined;
}
