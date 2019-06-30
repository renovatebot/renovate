module.exports = {
  extractPackageFile,
};

// NOTE: It looks like esy uses the same dependencies, devDependencies,
// buildDependencies fields in package.json as npm. But package.json also can
// have esy field. Also it uses both npm and opam, so a new datasource might
// be necessary.
function extractPackageFile(content) {
  logger.trace(`extractPackageFile()`);
  try {
    const doc = JSON.parse(content);
    if (doc.esy) {
      logger.info('esy field is present');
    }
  } catch (err) {
    return {};
  }
  return {};
}
