function getUntrustedEnv() {
  return {
    HTTP_PROXY: process.env.HTTP_PROXY,
    HTTPS_PROXY: process.env.HTTPS_PROXY,
    NO_PROXY: process.env.NO_PROXY,
    HOME: process.env.HOME,
    PATH: process.env.PATH,
  };
}

module.exports = {
  getUntrustedEnv,
};
