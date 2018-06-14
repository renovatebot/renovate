const got = require('got');
const xmlParser = require('fast-xml-parser');

module.exports = {
  getVersions,
  getNuspec,
};

const map = new Map();
const headers = {};

async function getVersions(name, retries = 5) {
  logger.trace(`getVersions(${name})`);

  const url = `https://api.nuget.org/v3-flatcontainer/${name.toLowerCase()}/index.json`;

  try {
    const result = (await got(url, {
      cache: process.env.RENOVATE_SKIP_CACHE ? undefined : map,
      json: true,
      retries,
      headers,
    })).body;

    return result.versions;
  } catch (err) {
    logger.warn({ err, name }, 'nuget getVersions failures: Unknown error');
    return null;
  }
}

async function getNuspec(name, version, retries = 5) {
  logger.trace(`getNuspec(${name} - ${version})`);

  const url = `https://api.nuget.org/v3-flatcontainer/${name.toLowerCase()}/${version}/${name.toLowerCase()}.nuspec`;

  try {
    const result = await got(url, {
      cache: process.env.RENOVATE_SKIP_CACHE ? undefined : map,
      json: false,
      retries,
      headers,
    });

    const nuspec = xmlParser.parse(result.body, { ignoreAttributes: false });

    return nuspec.package;
  } catch (err) {
    logger.warn({ err, name }, 'nuget getNuspec failures: Unknown error');
    return null;
  }
}
