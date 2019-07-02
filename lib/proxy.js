const { createGlobalProxyAgent } = require('global-agent');

module.exports = {
  bootstrap,
};

function bootstrap() {
  process.env.HTTP_PROXY = process.env.HTTP_PROXY || process.env.http_proxy;
  process.env.HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.https_proxy;
  process.env.NO_PROXY = process.env.NO_PROXY || process.env.no_proxy;
  return createGlobalProxyAgent({
    environmentVariableNamespace: '',
  });
}
