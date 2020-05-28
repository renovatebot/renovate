import URL from 'url';
import is from '@sindresorhus/is';
import parse from 'github-url-from-git';
import * as hostRules from '../util/host-rules';
import { ReleaseResult } from './common';

// Use this object to define changelog URLs for packages
// Only necessary when the changelog data cannot be found in the package's source repository
const manualChangelogUrls = {
  npm: {
    'babel-preset-react-app':
      'https://github.com/facebook/create-react-app/releases',
    firebase: 'https://firebase.google.com/support/release-notes/js',
    'flow-bin': 'https://github.com/facebook/flow/blob/master/Changelog.md',
    gatsby:
      'https://github.com/gatsbyjs/gatsby/blob/master/packages/gatsby/CHANGELOG.md',
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
    wagtail: 'https://github.com/wagtail/wagtail/tree/master/docs/releases',
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
export function addMetaData(
  dep?: ReleaseResult,
  datasource?: string,
  lookupName?: string
): void {
  if (!dep) {
    return;
  }
  const lookupNameLowercase = lookupName ? lookupName.toLowerCase() : null;
  if (
    manualChangelogUrls[datasource] &&
    manualChangelogUrls[datasource][lookupNameLowercase]
  ) {
    dep.changelogUrl = manualChangelogUrls[datasource][lookupNameLowercase];
  }
  if (
    manualSourceUrls[datasource] &&
    manualSourceUrls[datasource][lookupNameLowercase]
  ) {
    dep.sourceUrl = manualSourceUrls[datasource][lookupNameLowercase];
  }

  /**
   * @param {string} url
   */
  const massageGithubUrl = (url: string): string => {
    return url
      .replace('http:', 'https:')
      .replace(/^git:\/?\/?/, 'https://')
      .replace('www.github.com', 'github.com')
      .split('/')
      .slice(0, 5)
      .join('/');
  };
  /**
   * @param {string} url
   */
  const massageGitlabUrl = (url: string): string => {
    return url
      .replace('http:', 'https:')
      .replace(/^git:\/?\/?/, 'https://')
      .replace(/\/tree\/.*$/i, '')
      .replace(/\/$/i, '')
      .replace('.git', '');
  };

  if (
    dep.changelogUrl &&
    dep.changelogUrl.includes('github.com') && // lgtm [js/incomplete-url-substring-sanitization]
    !dep.sourceUrl
  ) {
    dep.sourceUrl = dep.changelogUrl;
  }
  // prettier-ignore
  if (dep.homepage && dep.homepage.includes('github.com')) { // lgtm [js/incomplete-url-substring-sanitization]
    if (!dep.sourceUrl) {
      dep.sourceUrl = dep.homepage;
    }
    delete dep.homepage;
  }
  const extraBaseUrls = [];
  // istanbul ignore next
  hostRules.hosts({ hostType: 'github' }).forEach((host) => {
    extraBaseUrls.push(host, `gist.${host}`);
  });
  extraBaseUrls.push('gitlab.com');
  if (dep.sourceUrl) {
    if (URL.parse(dep.sourceUrl).hostname.includes('gitlab')) {
      // try massaging it
      dep.sourceUrl =
        parse(massageGitlabUrl(dep.sourceUrl), {
          extraBaseUrls,
        }) || dep.sourceUrl;
    } else {
      // try massaging it
      dep.sourceUrl =
        parse(massageGithubUrl(dep.sourceUrl), {
          extraBaseUrls,
        }) || dep.sourceUrl;
    }
  }

  // Clean up any empty urls
  const urls = ['homepage', 'sourceUrl', 'changelogUrl'];
  for (const url of urls) {
    if (is.nonEmptyString(dep[url])) {
      dep[url] = dep[url].trim();
      // istanbul ignore if
      if (!dep[url].match(/^https?:\/\//)) {
        delete dep[url];
      }
    } else {
      delete dep[url];
    }
  }
}
