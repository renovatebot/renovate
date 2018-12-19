/* istanbul ignore file */
/* eslint-disable no-param-reassign */

const urlParse = require('url').parse;
const ProxyAgent = require('proxy-agent');
const http = require('http');
const https = require('https');

const envKeys = Object.keys(process.env).map(key => key.toLocaleUpperCase());
if (envKeys.includes('HTTP_PROXY') || envKeys.includes('HTTPS_PROXY')) {
  const proxy = new ProxyAgent();
  patch(http, 'http', proxy);
  patch(https, 'https', proxy);
}

function patch(httpOrHttps, protocol, proxy) {
  const originalRequest = httpOrHttps.request;
  httpOrHttps.request = function request(options, callback) {
    let opts;
    if (typeof opts === 'string') {
      opts = urlParse(options);
    } else {
      opts = Object.assign({}, options);
    }

    // Respect the default agent provided by node's lib/https.js
    if (
      (opts.agent === null || opts.agent === undefined) &&
      typeof opts.createConnection !== 'function' &&
      (opts.host || opts.hostname)
    ) {
      opts.agent = proxy;
    }

    // Set the default port ourselves to prevent Node doing it based on the proxy agent protocol
    if (
      opts.protocol === 'https:' ||
      (!opts.protocol && protocol === 'https')
    ) {
      opts.port = opts.port || 443;
    }
    if (opts.protocol === 'http:' || (!opts.protocol && protocol === 'http')) {
      opts.port = opts.port || 80;
    }
    return originalRequest.call(httpOrHttps, opts, callback);
  };
}
