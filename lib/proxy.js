const { createGlobalProxyAgent } = require('global-agent');

module.exports = {
  bootstrap,
};

const envVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY'];

function bootstrap() {
  envVars.forEach(envVar => {
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
