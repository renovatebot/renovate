const got = require('got');
const url = require('url');
const is = require('@sindresorhus/is');
const { matches } = require('../../versioning/pep440');

module.exports = {
  getPkgReleases,
};

function normalizeName(input) {
  return input.toLowerCase().replace(/(-|\.)/g, '_');
}

function compatibleVersions(releases, compatibility) {
  const versions = Object.keys(releases);
  if (!(compatibility && compatibility.python)) {
    return versions;
  }
  return versions.filter(version =>
    releases[version].some(release => {
      if (!release.requires_python) {
        return true;
      }
      return matches(compatibility.python, release.requires_python);
    })
  );
}

async function getPkgReleases(purl, config = {}) {
  const { compatibility } = config;
  const { fullname: depName } = purl;
  let hostUrls = ['https://pypi.org/pypi/'];
  if (is.nonEmptyArray(config.registryUrls)) {
    hostUrls = config.registryUrls;
  }
  if (process.env.PIP_INDEX_URL) {
    hostUrls = [process.env.PIP_INDEX_URL];
  }
  for (const hostUrl of hostUrls) {
    const dep = await getDependency(depName, hostUrl, compatibility);
    if (dep !== null) {
      return dep;
    }
  }
  return null;
}

async function getDependency(depName, hostUrl, compatibility) {
  const lookupUrl = url.resolve(hostUrl, `${depName}/json`);
  try {
    const dependency = {};
    const rep = await got(url.parse(lookupUrl), {
      json: true,
    });
    const dep = rep && rep.body;
    if (!dep) {
      logger.debug({ dependency: depName }, 'pip package not found');
      return null;
    }
    if (
      !(dep.info && normalizeName(dep.info.name) === normalizeName(depName))
    ) {
      logger.warn(
        { lookupUrl, lookupName: depName, returnedName: dep.info.name },
        'Returned name does not match with requested name'
      );
      return null;
    }
    if (dep.info && dep.info.home_page) {
      if (dep.info.home_page.match(/^https?:\/\/github.com/)) {
        dependency.sourceUrl = dep.info.home_page.replace(
          'http://',
          'https://'
        );
      } else {
        dependency.homepage = dep.info.home_page;
      }
    }
    dependency.releases = [];
    if (dep.releases) {
      const versions = compatibleVersions(dep.releases, compatibility);
      dependency.releases = versions.map(version => ({
        version,
        releaseTimestamp: (dep.releases[version][0] || {}).upload_time,
      }));
    }
    return dependency;
  } catch (err) {
    logger.info(
      'pypi dependency not found: ' + depName + '(searching in ' + hostUrl + ')'
    );
    return null;
  }
}
