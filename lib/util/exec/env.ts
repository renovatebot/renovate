import { GlobalConfig } from '../../config/global';

const basicEnvVars = [
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
  'HOME',
  'PATH',
  'LC_ALL',
  'LANG',
  'DOCKER_HOST',
  'DOCKER_TLS_VERIFY',
  'DOCKER_CERT_PATH',
];

export function getChildProcessEnv(
  customEnvVars: string[] = []
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  if (GlobalConfig.get('exposeAllEnv')) {
    return { ...process.env };
  }
  const envVars = [...basicEnvVars, ...customEnvVars];
  envVars.forEach((envVar) => {
    if (typeof process.env[envVar] !== 'undefined') {
      env[envVar] = process.env[envVar];
    }
  });
  return env;
}
