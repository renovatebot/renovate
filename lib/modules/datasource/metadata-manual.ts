// Use this object to define changelog URLs for packages
// Only necessary when the changelog data cannot be found in the package's source repository
export const manualChangelogUrls: Record<string, Record<string, string>> = {
  npm: {
    'babel-preset-react-app':
      'https://github.com/facebook/create-react-app/releases',
    firebase: 'https://firebase.google.com/support/release-notes/js',
    'flow-bin': 'https://github.com/facebook/flow/blob/master/Changelog.md',
    gatsby:
      'https://github.com/gatsbyjs/gatsby/blob/master/packages/gatsby/CHANGELOG.md',
    'react-native':
      'https://github.com/react-native-community/react-native-releases/blob/master/CHANGELOG.md',
    sharp: 'https://github.com/lovell/sharp/blob/main/docs/changelog.md',
    'tailwindcss-classnames':
      'https://github.com/muhammadsammy/tailwindcss-classnames/blob/master/CHANGELOG.md',
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
    flake8: 'https://flake8.pycqa.org/en/latest/release-notes/index.html',
    'django-storages':
      'https://github.com/jschneier/django-storages/blob/master/CHANGELOG.rst',
    hypothesis:
      'https://github.com/HypothesisWorks/hypothesis/blob/master/hypothesis-python/docs/changes.rst',
    lxml: 'https://git.launchpad.net/lxml/plain/CHANGES.txt',
    mypy: 'https://mypy-lang.blogspot.com/',
    phonenumbers:
      'https://github.com/daviddrysdale/python-phonenumbers/blob/dev/python/HISTORY.md',
    psycopg2: 'https://initd.org/psycopg/articles/tag/release/',
    'psycopg2-binary': 'https://initd.org/psycopg/articles/tag/release/',
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
    'google/cloud-sdk': 'https://cloud.google.com/sdk/docs/release-notes',
    neo4j: 'https://neo4j.com/release-notes/',
    'whitesource/renovate': 'https://github.com/whitesource/renovate-on-prem',
  },
};

// Use this object to define manual source URLs for packages
// Only necessary if the datasource is unable to locate the source URL itself
export const manualSourceUrls: Record<string, Record<string, string>> = {
  orb: {
    'cypress-io/cypress': 'https://github.com/cypress-io/circleci-orb',
    'hutson/library-release-workflows':
      'https://github.com/hyper-expanse/library-release-workflows',
  },
  docker: {
    'amd64/registry': 'https://github.com/distribution/distribution',
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
    'mcr.microsoft.com/dotnet/aspnet': 'https://github.com/dotnet/aspnetcore',
    'mcr.microsoft.com/dotnet/monitor':
      'https://github.com/dotnet/dotnet-monitor',
    'mcr.microsoft.com/dotnet/runtime': 'https://github.com/dotnet/runtime',
    'mcr.microsoft.com/dotnet/runtime-deps':
      'https://github.com/dotnet/runtime',
    'mcr.microsoft.com/dotnet/sdk': 'https://github.com/dotnet/sdk',
    node: 'https://github.com/nodejs/node',
    registry: 'https://github.com/distribution/distribution',
  },
  kubernetes: {
    node: 'https://github.com/nodejs/node',
  },
  maven: {
    'com.figure.gradle.semver-plugin:com.figure.gradle.semver-plugin.gradle.plugin':
      'https://github.com/FigureTechnologies/gradle-semver-plugin',
  },
  npm: {
    node: 'https://github.com/nodejs/node',
  },
  nvm: {
    node: 'https://github.com/nodejs/node',
  },
  pypi: {
    mkdocs: 'https://github.com/mkdocs/mkdocs',
    'mkdocs-material': 'https://github.com/squidfunk/mkdocs-material',
    mypy: 'https://github.com/python/mypy',
  },
};
