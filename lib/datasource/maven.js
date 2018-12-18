
module.exports = {
  getPkgReleases
};

async function getPkgReleases(purl, config) {

  logger.warn('*************');
  logger.warn(purl);
  logger.warn(config.maven);

  const dep = purl.fullname.split(':');
  logger.warn(dep);
  config.maven.repositories[0]
}
