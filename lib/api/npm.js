// Most of this borrowed from https://github.com/sindresorhus/package-json/blob/master/index.js

const got = require('got');
const url = require('url');
const registryUrl = require('registry-url');
const registryAuthToken = require('registry-auth-token');
const logger = require('winston');

module.exports = {
  getDependency,
};

async function getDependency(name) {
  logger.debug(`getDependency(${name})`);
  const scope = name.split('/')[0];
  const regUrl = registryUrl(scope);
  const pkgUrl = url.resolve(
    regUrl,
    encodeURIComponent(name).replace(/^%40/, '@')
  );
  const authInfo = registryAuthToken(regUrl);
  const headers = {};

  // Reduce metadata https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md
  headers.accept = 'application/vnd.npm.install-v1+json';

  if (authInfo) {
    headers.authorization = `${authInfo.type} ${authInfo.token}`;
  }

  try {
    const res = await got(pkgUrl, {
      json: true,
      headers,
    });
    return res.body;
  } catch (err) {
    logger.warn(`Dependency not found: ${name}`);
    logger.debug(`err: ${JSON.stringify(err)}`);
    return null;
  }
}
