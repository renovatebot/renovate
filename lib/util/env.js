function getUntrustedEnv(customEnvVars = []) {
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
    } else if (typeof process.env[envVar.toLowerCase()] !== 'undefined') {
      env[envVar] = process.env[envVar.toLowerCase()];
    }
  });
  return env;
}

module.exports = {
  getUntrustedEnv,
};
