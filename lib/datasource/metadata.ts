import URL from 'url';
import parse from 'github-url-from-git';
import { DateTime } from 'luxon';
import * as hostRules from '../util/host-rules';
import { validateUrl } from '../util/url';
import type { ReleaseResult } from './types';

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
    sharp: 'https://github.com/lovell/sharp/blob/master/docs/changelog.md',
    'zone.js':
      'https://github.com/angular/angular/blob/master/packages/zone.js/CHANGELOG.md',
  },
  pypi: {
    alembic: 'https://alembic.sqlalchemy.org/en/latest/changelog.html',
    beautifulsoup4:
      'https://bazaar.launchpad.net/~leonardr/beautifulsoup/bs4/view/head:/CHANGELOG',
    django: 'https://github.com/django/django/tree/master/docs/releases',
    djangorestframework:
      'https://www.django-rest-framework.org/community/release-notes/',
    flake8: 'http://flake8.pycqa.org/en/latest/release-notes/index.html',
    'django-storages':
      'https://github.com/jschneier/django-storages/blob/master/CHANGELOG.rst',
    hypothesis:
      'https://github.com/HypothesisWorks/hypothesis/blob/master/hypothesis-python/docs/changes.rst',
    lxml: 'https://git.launchpad.net/lxml/plain/CHANGES.txt',
    mypy: 'https://mypy-lang.blogspot.com/',
    phonenumbers:
      'https://github.com/daviddrysdale/python-phonenumbers/blob/dev/python/HISTORY.md',
    psycopg2: 'http://initd.org/psycopg/articles/tag/release/',
    'psycopg2-binary': 'http://initd.org/psycopg/articles/tag/release/',
    pycountry:
      'https://github.com/flyingcircusio/pycountry/blob/master/HISTORY.txt',
    'django-debug-toolbar':
      'https://django-debug-toolbar.readthedocs.io/en/latest/changes.html',
    'firebase-admin':
      'https://firebase.google.com/support/release-notes/admin/python',
    requests: 'https://github.com/psf/requests/blob/master/HISTORY.md',
    sqlalchemy: 'https://docs.sqlalchemy.org/en/latest/changelog/',
    uwsgi: 'https://uwsgi-docs.readthedocs.io/en/latest/#release-notes',
    wagtail: 'https://github.com/wagtail/wagtail/tree/master/docs/releases',
  },
  docker: {
    'gitlab/gitlab-ce':
      'https://gitlab.com/gitlab-org/gitlab-foss/-/blob/master/CHANGELOG.md',
    'gitlab/gitlab-runner':
      'https://gitlab.com/gitlab-org/gitlab-runner/-/blob/master/CHANGELOG.md',
    neo4j: 'https://neo4j.com/release-notes/',
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
    'amd64/traefik': 'https://github.com/containous/traefik',
    'coredns/coredns': 'https://github.com/coredns/coredns',
    'docker/compose': 'https://github.com/docker/compose',
    'drone/drone': 'https://github.com/drone/drone',
    'drone/drone-runner-docker':
      'https://github.com/drone-runners/drone-runner-docker',
    'drone/drone-runner-kube':
      'https://github.com/drone-runners/drone-runner-kube',
    'drone/drone-runner-ssh':
      'https://github.com/drone-runners/drone-runner-ssh',
    'gcr.io/kaniko-project/executor':
      'https://github.com/GoogleContainerTools/kaniko',
    'gitlab/gitlab-ce': 'https://gitlab.com/gitlab-org/gitlab-foss',
    'gitlab/gitlab-runner': 'https://gitlab.com/gitlab-org/gitlab-runner',
    'gitea/gitea': 'https://github.com/go-gitea/gitea',
    'hashicorp/terraform': 'https://github.com/hashicorp/terraform',
    node: 'https://github.com/nodejs/node',
    traefik: 'https://github.com/containous/traefik',
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
    mkdocs: 'https://github.com/mkdocs/mkdocs',
    mypy: 'https://github.com/python/mypy',
  },
};

function massageGithubUrl(url: string): string {
  return url
    .replace('http:', 'https:')
    .replace(/^git:\/?\/?/, 'https://')
    .replace('www.github.com', 'github.com')
    .split('/')
    .slice(0, 5)
    .join('/');
}

function massageGitlabUrl(url: string): string {
  return url
    .replace('http:', 'https:')
    .replace(/^git:\/?\/?/, 'https://')
    .replace(/\/tree\/.*$/i, '')
    .replace(/\/$/i, '')
    .replace('.git', '');
}

function normalizeDate(input: any): string | null {
  if (
    typeof input === 'number' &&
    !Number.isNaN(input) &&
    input > 0 &&
    input <= Date.now() + 24 * 60 * 60 * 1000
  ) {
    return new Date(input).toISOString();
  }

  if (typeof input === 'string') {
    // `Date.parse()` is more permissive, but it assumes local time zone
    // for inputs like `2021-01-01`.
    //
    // Here we try to parse with default UTC with fallback to `Date.parse()`.
    //
    // It allows us not to care about machine timezones so much, though
    // some misinterpretation is still possible, but only if both:
    //
    //   1. Renovate machine is configured for non-UTC zone
    //   2. Format of `input` is very exotic
    //      (from `DateTime.fromISO()` perspective)
    //
    const luxonDate = DateTime.fromISO(input, { zone: 'UTC' });
    if (luxonDate.isValid) {
      return luxonDate.toISO();
    }

    return normalizeDate(Date.parse(input));
  }

  if (input instanceof Date) {
    return input.toISOString();
  }

  return null;
}

function massageTimestamps(dep: ReleaseResult): void {
  for (const release of dep.releases || []) {
    let { releaseTimestamp } = release;
    delete release.releaseTimestamp;
    releaseTimestamp = normalizeDate(releaseTimestamp);
    if (releaseTimestamp) {
      release.releaseTimestamp = releaseTimestamp;
    }
  }
}

/* eslint-disable no-param-reassign */
export function addMetaData(
  dep?: ReleaseResult,
  datasource?: string,
  lookupName?: string
): void {
  if (!dep) {
    return;
  }

  massageTimestamps(dep);

  const lookupNameLowercase = lookupName ? lookupName.toLowerCase() : null;
  if (manualChangelogUrls[datasource]?.[lookupNameLowercase]) {
    dep.changelogUrl = manualChangelogUrls[datasource][lookupNameLowercase];
  }
  if (manualSourceUrls[datasource]?.[lookupNameLowercase]) {
    dep.sourceUrl = manualSourceUrls[datasource][lookupNameLowercase];
  }

  if (
    dep.changelogUrl?.includes('github.com') && // lgtm [js/incomplete-url-substring-sanitization]
    !dep.sourceUrl
  ) {
    dep.sourceUrl = dep.changelogUrl;
  }
  // prettier-ignore
  if (dep.homepage?.includes('github.com')) { // lgtm [js/incomplete-url-substring-sanitization]
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
    const parsedUrl = URL.parse(dep.sourceUrl);
    if (parsedUrl?.hostname) {
      let massagedUrl;
      if (parsedUrl.hostname.includes('gitlab')) {
        massagedUrl = massageGitlabUrl(dep.sourceUrl);
      } else {
        massagedUrl = massageGithubUrl(dep.sourceUrl);
      }
      // try massaging it
      dep.sourceUrl =
        parse(massagedUrl, {
          extraBaseUrls,
        }) || dep.sourceUrl;
    } else {
      delete dep.sourceUrl;
    }
  }

  // Clean up any empty urls
  const urls = ['homepage', 'sourceUrl', 'changelogUrl', 'dependencyUrl'];
  for (const url of urls) {
    if (validateUrl(dep[url]?.trim())) {
      dep[url] = dep[url].trim();
    } else {
      delete dep[url];
    }
  }
}
