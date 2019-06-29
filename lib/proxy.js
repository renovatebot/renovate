const { createGlobalProxyAgent } = require('global-agent');

module.exports = {
  bootstrap,
};

function bootstrap() {
  return createGlobalProxyAgent({
    environmentVariableNamespace: '',
  });
}
