export const PKG_SERVER_REQUEST_HEADERS = {
  // To not mess with the statistics Julia's package servers aggregate (e.g.
  // distinguishing actual users from automated processes, etc.), indicate that
  // this is a bot/CI process
  'Julia-CI-Variables': 'CI=t;RENOVATE=t',
};

export const juliaPkgServerDatasourceId = 'julia-pkg-server';
