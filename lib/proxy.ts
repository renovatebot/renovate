import {
  createGlobalProxyAgent,
  ProxyAgentConfigurationType,
} from 'global-agent';

const envVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY'];

export function bootstrap(): ProxyAgentConfigurationType {
  envVars.forEach(envVar => {
    /* istanbul ignore if: env is case-insensitive on windows */
    if (
      typeof process.env[envVar] === 'undefined' &&
      typeof process.env[envVar.toLowerCase()] !== 'undefined'
    ) {
      process.env[envVar] = process.env[envVar.toLowerCase()];
    }
  });
  return createGlobalProxyAgent({
    environmentVariableNamespace: '',
  });
}
