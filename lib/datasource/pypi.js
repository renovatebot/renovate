const got = require('got');
const url = require('url');
const is = require('@sindresorhus/is');
const { isVersion, sortVersions, matches } = require('../versioning')('pep440');

module.exports = {
  getPkgReleases,
};

function normalizeName(input) {
  return input.toLowerCase().replace(/(-|\.)/g, '_');
}

// This is a manual list of changelog URLs for dependencies that don't publish to repositoryUrl
// Make these lower case
const changelogUrls = {
  'pytest-django':
    'https://pytest-django.readthedocs.io/en/latest/changelog.html#changelog',
  django: 'https://github.com/django/django/tree/master/docs/releases',
  djangorestframework:
    'https://www.django-rest-framework.org/community/release-notes/',
  flake8: 'http://flake8.pycqa.org/en/latest/release-notes/index.html',
  'django-storages':
    'https://github.com/jschneier/django-storages/blob/master/CHANGELOG.rst',
  phonenumbers:
    'https://github.com/daviddrysdale/python-phonenumbers/blob/dev/python/HISTORY.md',
  'psycopg2-binary': 'http://initd.org/psycopg/articles/tag/release/',
  'django-debug-toolbar':
    'https://django-debug-toolbar.readthedocs.io/en/latest/changes.html',
};

function compatibleVersions(releases, compatibility) {
  const versions = Object.keys(releases)
    .filter(isVersion)
    .sort(sortVersions);
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
    const rep = await got(lookupUrl, {
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
        dependency.repositoryUrl = dep.info.home_page.replace(
          'http://',
          'https://'
        );
      } else {
        dependency.homepage = dep.info.home_page;
      }
    }
    const manualRepositories = {
      mkdocs: 'https://github.com/mkdocs/mkdocs',
      pillow: 'https://github.com/python-pillow/Pillow',
    };
    dependency.repositoryUrl =
      dependency.repositoryUrl || manualRepositories[depName.toLowerCase()];
    dependency.releases = [];
    if (dep.releases) {
      const versions = compatibleVersions(dep.releases, compatibility);
      dependency.releases = versions.map(version => ({
        version,
        releaseTimestamp: (dep.releases[version][0] || {}).upload_time,
      }));
    }
    // istanbul ignore if
    if (changelogUrls[depName.toLowerCase()]) {
      dependency.changelogUrl =
        changelogUrls[depName.toLowerCase()] || dependency.changelogUrl;
      if (
        !dependency.repositoryUrl &&
        dependency.changelogUrl.startsWith('https://github.com/')
      ) {
        dependency.repositoryUrl = dependency.changelogUrl
          .split('/')
          .slice(0, 5)
          .join('/');
      }
    }
    return dependency;
  } catch (err) {
    logger.info(
      'pypi dependency not found: ' + depName + '(searching in ' + hostUrl + ')'
    );
    return null;
  }
}
