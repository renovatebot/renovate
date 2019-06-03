const url = require('url');
const is = require('@sindresorhus/is');
const { parse } = require('node-html-parser');
const { matches } = require('../../versioning/pep440');
const got = require('../../util/got');

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

async function getPkgReleases({ compatibility, lookupName, registryUrls }) {
  let hostUrls = ['https://pypi.org/pypi/'];
  if (is.nonEmptyArray(registryUrls)) {
    hostUrls = registryUrls;
  }
  if (process.env.PIP_INDEX_URL) {
    hostUrls = [process.env.PIP_INDEX_URL];
  }
  for (let hostUrl of hostUrls) {
    hostUrl += hostUrl.endsWith('/') ? '' : '/';
    let dep;
    if (hostUrl.endsWith('/simple/')) {
      dep = await getSimpleDependency(lookupName, hostUrl);
    } else {
      dep = await getDependency(lookupName, hostUrl, compatibility);
    }
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
      hostType: 'pypi',
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

async function getSimpleDependency(depName, hostUrl) {
  const lookupUrl = url.resolve(hostUrl, `${depName}`);
  try {
    const dependency = {};
    const response = await got(url.parse(lookupUrl), {
      json: false,
      hostType: 'pypi',
    });
    const dep = response && response.body;
    if (!dep) {
      logger.debug({ dependency: depName }, 'pip package not found');
      return null;
    }
    const root = parse(dep);
    const links = root.querySelectorAll('a');
    const versions = new Set();
    for (const link of links) {
      const result = extractVersionFromLinkText(link.text);
      if (result) {
        versions.add(result);
      }
    }
    dependency.releases = [];
    if (versions && versions.size > 0) {
      dependency.releases = [...versions].map(version => ({
        version,
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

function extractVersionFromLinkText(text) {
  const versionRegexp = /\d+(\.\d+)+/;
  const result = text.match(versionRegexp);
  if (result && result.length > 0) {
    return result[0];
  }
  return null;
}
