const urlApi = require('url');
const got = require('../../util/got');
const hostRules = require('../../util/host-rules');

module.exports = {
  get,
};

async function get(url, options) {
  const finalOptions = options || {};
  const { host } = urlApi.parse(url);
  const hostRule = hostRules.find({ platform: 'nuget', host });
  if (hostRule && hostRule.username && hostRule.password) {
    const auth = Buffer.from(
      `${hostRule.username}:${hostRule.password}`
    ).toString('base64');
    finalOptions.headers = finalOptions.headers || {};
    finalOptions.headers.Authorization = `Basic ${auth}`;
    logger.debug(
      { url },
      `Setting basic auth header as configured via host rule`
    );
  }
  return got(url, finalOptions);
}
