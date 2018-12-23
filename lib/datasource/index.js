const { parse } = require('../util/purl');

const orb = require('./orb');
const docker = require('./docker');
const github = require('./github');
const go = require('./go');
const npm = require('./npm');
const nuget = require('./nuget');
const packagist = require('./packagist');
const pypi = require('./pypi');
const terraform = require('./terraform');
const gitlab = require('./gitlab');
const cargo = require('./cargo');

const datasources = {
  orb,
  docker,
  github,
  go,
  npm,
  nuget,
  packagist,
  pypi,
  terraform,
  gitlab,
  cargo,
};

// Use this object to define changelog URLs for packages
// Only necessary when the changelog data cannot be found in the package's source repository
const manualChangelogUrls = {
  npm: {
    firebase: 'https://firebase.google.com/support/release-notes/js',
    'flow-bin': 'https://github.com/facebook/flow/blob/master/Changelog.md',
    'react-native':
      'https://github.com/react-native-community/react-native-releases/blob/master/CHANGELOG.md',
  },
  pypi: {
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
    'firebase-admin':
      'https://firebase.google.com/support/release-notes/admin/python',
    requests:
      'http://docs.python-requests.org/en/master/community/updates/#release-and-version-history',
  },
};

// Use this object to define manual source URLs for packages
// Only necessary if the datasource is unable to locate the source URL itself
const manualSourceUrls = {
  orb: {
    'cypress-io/cypress': 'https://github.com/cypress-io/circleci-orb',
    'hutson/library-release-workflows':
      'https://github.com/hyper-expanse/library-release-workflows',
  },
  docker: {
    node: 'https://github.com/nodejs/node',
  },
  kubernetes: {
    node: 'https://github.com/nodejs/node',
  },
  npm: {
    node: 'https://github.com/nodejs/node',
  },
  nvm: {
    node: 'https://github.com/nodejs/node',
  },
  pypi: {
    coverage: 'https://github.com/nedbat/coveragepy/', // bitbucket entry on pypi is wrong
    mkdocs: 'https://github.com/mkdocs/mkdocs',
    pillow: 'https://github.com/python-pillow/Pillow',
  },
};

async function getPkgReleases(purlStr, config) {
  const purl = parse(purlStr);
  if (!purl) {
    return null;
  }
  if (!datasources[purl.type]) {
    logger.warn('Unknown purl type: ' + purl.type);
    return null;
  }
  const res = await datasources[purl.type].getPkgReleases(purl, config);
  if (res) {
    if (
      manualChangelogUrls[purl.type] &&
      manualChangelogUrls[purl.type][purl.fullname.toLowerCase()]
    ) {
      res.changelogUrl =
        manualChangelogUrls[purl.type][purl.fullname.toLowerCase()];
    }
    if (
      manualSourceUrls[purl.type] &&
      manualSourceUrls[purl.type][purl.fullname.toLowerCase()]
    ) {
      res.sourceUrl = manualSourceUrls[purl.type][purl.fullname.toLowerCase()];
    }
    if (
      !res.sourceUrl &&
      res.changelogUrl &&
      res.changelogUrl.startsWith('https://github.com/')
    ) {
      res.sourceUrl = res.changelogUrl
        .split('/')
        .slice(0, 5)
        .join('/');
    }
  }
  return res;
}

function supportsDigests(purlStr) {
  const purl = parse(purlStr);
  return !!datasources[purl.type].getDigest;
}

function getDigest(config, value) {
  const purl = parse(config.purl);
  return datasources[purl.type].getDigest(config, value);
}

module.exports = {
  getPkgReleases,
  supportsDigests,
  getDigest,
};
