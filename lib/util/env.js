function getChildProcessEnv(customEnvVars = []) {
  if (global.trustLevel === 'high') {
    return process.env;
  }
  const envVars = [
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'NO_PROXY',
    'HOME',
    'PATH',
    ...customEnvVars,
  ];
  const env = {};
  envVars.forEach(envVar => {
    if (typeof process.env[envVar] !== 'undefined') {
      env[envVar] = process.env[envVar];
    }
  });
  return env;
}

module.exports = {
  getChildProcessEnv,
};
