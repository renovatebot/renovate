// Most of this borrowed from https://github.com/sindresorhus/package-json/blob/master/index.js

const got = require('got');
const url = require('url');
const registryUrl = require('registry-url');
const registryAuthToken = require('registry-auth-token');

module.exports = {
  getDependency,
};

async function getDependency(name) {
  const scope = name.split('/')[0];
  const regUrl = registryUrl(scope);
  const pkgUrl = url.resolve(
    regUrl,
    encodeURIComponent(name).replace(/^%40/, '@')
  );
  const authInfo = registryAuthToken(regUrl);
  const headers = {};

  if (authInfo) {
    headers.authorization = `${authInfo.type} ${authInfo.token}`;
  }

  const res = await got(pkgUrl, {
    json: true,
    headers,
  });
  return res.body;
}
