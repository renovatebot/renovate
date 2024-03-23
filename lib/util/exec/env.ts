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
  // Custom certificte variables
  // https://github.com/containerbase/base/blob/main/docs/custom-root-ca.md
  'SSL_CERT_DIR',
  'SSL_CERT_FILE',
  'NODE_EXTRA_CA_CERTS',
  // Required for NuGet to work on Windows.
  'PROGRAMFILES',
  'PROGRAMFILES(X86)',
  'APPDATA',
  'LOCALAPPDATA',
  // Corepack: https://github.com/nodejs/corepack
  'COREPACK_DEFAULT_TO_LATEST',
  'COREPACK_ENABLE_NETWORK',
  'COREPACK_ENABLE_STRICT',
  'COREPACK_ENABLE_PROJECT_SPEC',
  'COREPACK_ENABLE_UNSAFE_CUSTOM_URLS',
  'COREPACK_HOME',
  'COREPACK_NPM_REGISTRY',
  'COREPACK_NPM_TOKEN',
  'COREPACK_NPM_USERNAME',
  'COREPACK_NPM_PASSWORD',
  'COREPACK_ROOT',
];

export function getChildProcessEnv(
  customEnvVars: string[] = [],
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

  // Copy containerbase url replacements
  for (const key of Object.keys(process.env)) {
    if (/^URL_REPLACE_\d+_(?:FROM|TO)$/.test(key)) {
      env[key] = process.env[key];
    }
  }
  return env;
}
