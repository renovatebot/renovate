const { coerce } = require('semver');

module.exports = {
  extractPackageFile,
};

function extractPackageFile(fileContent) {
  logger.debug('gradle-wrapper.extractPackageFile()');
  const lines = fileContent.split('\n');

  let lineNumber = 0;
  for (const line of lines) {
    const match = line.match(
      /^distributionUrl=.*-((\d|\.)+)-(bin|all)\.zip\s*$/
    );
    if (match) {
      const dependency = {
        purl: 'pkg:gradleVersion',
        depType: 'gradle-wrapper',
        depName: 'gradle',
        currentValue: coerce(match[1]).toString(),
        lineNumber,
        versionScheme: 'semver',
        /* gradle specifics ... */
        gradleWrapperType: match[3],
      };

      let shaLineNumber = 0;
      for (const shaLine of lines) {
        const shaMatch = shaLine.match(/^distributionSha256Sum=((\w){64}).*$/);
        if (shaMatch) {
          dependency.checksumLineNumber = shaLineNumber;
          break;
        }
        shaLineNumber += 1;
      }

      logger.info(dependency, 'Gradle Wrapper');
      return { deps: [dependency] };
    }
    lineNumber += 1;
  }
  return null;
}
