const is = require('@sindresorhus/is');

module.exports = {
  addMetaData,
};

// Use this object to define changelog URLs for packages
// Only necessary when the changelog data cannot be found in the package's source repository
const manualChangelogUrls = {
  npm: {
    'babel-preset-react-app':
      'https://github.com/facebook/create-react-app/releases',
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

/* eslint-disable no-param-reassign */
function addMetaData(purl, dep) {
  if (!dep) {
    return;
  }
  const depName = purl.fullname.toLowerCase();
  if (
    manualChangelogUrls[purl.type] &&
    manualChangelogUrls[purl.type][depName]
  ) {
    dep.changelogUrl = manualChangelogUrls[purl.type][depName];
  }
  if (manualSourceUrls[purl.type] && manualSourceUrls[purl.type][depName]) {
    dep.sourceUrl = manualSourceUrls[purl.type][depName];
  }
  if (
    !dep.sourceUrl &&
    dep.changelogUrl &&
    dep.changelogUrl.startsWith('https://github.com/')
  ) {
    dep.sourceUrl = dep.changelogUrl
      .split('/')
      .slice(0, 5)
      .join('/');
  }
  // Clean up any empty urls
  const urls = ['homepage', 'sourceUrl', 'changelogUrl'];
  for (const url of urls) {
    if (!is.nonEmptyString(dep[url])) {
      delete dep[url];
    }
  }
}
