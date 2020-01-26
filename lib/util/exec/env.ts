const basicEnvVars = [
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'HOME',
  'PATH',
  'DOCKER_HOST',
];

export function getChildProcessEnv(
  customEnvVars: string[] = []
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  if (global.trustLevel === 'high') {
    return Object.assign(env, process.env);
  }
  const envVars = [...basicEnvVars, ...customEnvVars];
  envVars.forEach(envVar => {
    if (typeof process.env[envVar] !== 'undefined') {
      env[envVar] = process.env[envVar];
    }
  });
  return env;
}
