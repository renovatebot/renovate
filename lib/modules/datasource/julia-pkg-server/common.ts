export const PKG_SERVER_REQUEST_HEADERS = {
  // Tell Julia package servers that this is a bot/CI process.
  // This helps Julia package servers recognize traffic from bots and human users.
  'Julia-CI-Variables': 'CI=t;RENOVATE=t',
};

export const juliaPkgServerDatasourceId = 'julia-pkg-server';
