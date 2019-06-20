import { createGlobalProxyAgent } from 'global-agent';

// eslint-disable-next-line import/prefer-default-export
export function bootstrap() {
  return createGlobalProxyAgent({
    environmentVariableNamespace: '',
  });
}
