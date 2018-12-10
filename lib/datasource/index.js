const { parse } = require('../util/purl');

const docker = require('./docker');
const github = require('./github');
const go = require('./go');
const npm = require('./npm');
const nuget = require('./nuget');
const packagist = require('./packagist');
const pypi = require('./pypi');
const terraform = require('./terraform');

const datasources = {
  docker,
  github,
  go,
  npm,
  nuget,
  packagist,
  pypi,
  terraform,
};

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
