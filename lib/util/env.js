function getUntrustedEnv(...customEnvVars) {
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
    if (process.env[envVar]) {
      env[envVar] = process.env[envVar];
    } else if (process.env[envVar.toLowerCase()]) {
      env[envVar] = process.env[envVar.toLowerCase()];
    }
  });
  return env;
}

module.exports = {
  getUntrustedEnv,
};
