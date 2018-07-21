const { splitImageParts, getPurl } = require('../docker/extract');

module.exports = {
  extractDependencies,
};

function extractDependencies(content) {
  const deps = [];
  try {
    const lines = content.split('\n');
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      const line = lines[lineNumber];
      const imageMatch = line.match(/^\s*image:\s*'?"?([^\s]+)'?"?\s*$/);
      if (imageMatch) {
        logger.trace(`Matched image on line ${lineNumber}`);
        const currentFrom = imageMatch[1];
        const {
          dockerRegistry,
          depName,
          currentTag,
          currentDigest,
          currentDepTagDigest,
          currentDepTag,
          currentValue,
          tagSuffix,
        } = splitImageParts(currentFrom);
        logger.info(
          { dockerRegistry, depName, currentTag, currentDigest },
          'GitLab CI image'
        );
        const purl = getPurl(dockerRegistry, depName, tagSuffix);
        const dep = {
          lineNumber,
          currentFrom,
          currentDepTagDigest,
          dockerRegistry,
          currentDepTag,
          currentDigest,
          depName,
          currentTag,
          currentValue,
          tagSuffix,
          purl,
          versionScheme: 'docker',
        };
        if (depName === 'node' || depName.endsWith('/node')) {
          dep.commitMessageTopic = 'Node.js';
        }
        deps.push(dep);
      }
      const services = line.match(/^\s*services:\s*$/);
      if (services) {
        logger.trace(`Matched services on line ${lineNumber}`);
        let foundImage;
        do {
          foundImage = false;
          const serviceImageLine = lines[lineNumber + 1];
          logger.trace(`serviceImageLine: "${serviceImageLine}"`);
          const serviceImageMatch = serviceImageLine.match(
            /^\s*-\s*'?"?([^\s'"]+)'?"?\s*$/
          );
          if (serviceImageMatch) {
            logger.trace('serviceImageMatch');
            foundImage = true;
            const currentFrom = serviceImageMatch[1];
            const {
              dockerRegistry,
              depName,
              currentTag,
              currentDigest,
              currentDepTagDigest,
              currentDepTag,
              currentValue,
              tagSuffix,
            } = splitImageParts(currentFrom);
            logger.info(
              { dockerRegistry, depName, currentTag, currentDigest },
              'GitLab CI services image'
            );
            lineNumber += 1;
            const purl = getPurl(dockerRegistry, depName, tagSuffix);
            const dep = {
              lineNumber,
              currentFrom,
              currentDepTagDigest,
              dockerRegistry,
              currentDepTag,
              currentDigest,
              depName,
              currentTag,
              currentValue,
              tagSuffix,
              purl,
              versionScheme: 'docker',
            };
            if (depName === 'node' || depName.endsWith('/node')) {
              dep.commitMessageTopic = 'Node.js';
            }
            deps.push(dep);
          }
        } while (foundImage);
      }
    }
  } catch (err) {
    logger.error(
      { err, message: err.message },
      'Error extracting GitLab CI dependencies'
    );
  }
  return deps;
}
