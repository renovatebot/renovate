const URL = require('url');
const tunnel = require('tunnel');
const getProxyForUrl = require('proxy-from-env').getProxyForUrl;

function gotAgent(path) {
  let agent;
  const proxyUrl = getProxyForUrl(path);

  if (proxyUrl) {
    logger.info(`Using proxy ${proxyUrl} for ${path}`);

    const parsedProxyUrl = URL.parse(proxyUrl);
    const tunnelProtocol =
      parsedProxyUrl.protocol === 'https:' ? 'Https' : 'Http';
    const proxyConfig = {
      proxy: {
        host: parsedProxyUrl.hostname,
        port: parsedProxyUrl.port,
        proxyAuth: parsedProxyUrl.auth,
      },
    };

    agent = {
      http: tunnel[`httpOver${tunnelProtocol}`](proxyConfig),
      https: tunnel[`httpsOver${tunnelProtocol}`](proxyConfig),
    };
  }

  return agent;
}

module.exports = gotAgent;
