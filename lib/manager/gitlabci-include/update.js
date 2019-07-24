const YAWN = require('yawn-yaml/cjs');
const { logger } = require('../../logger');

module.exports = {
  updateDependency,
};

function updateDependency(currentFileContent, upgrade) {
  try {
    const { depName, newValue } = upgrade;

    const yawn = new YAWN(currentFileContent);

    const doc = yawn.json;

    for (const includeObj of doc.include) {
      if (
        includeObj.project &&
        includeObj.ref &&
        includeObj.project === depName
      ) {
        includeObj.ref = newValue;
      }
    }

    yawn.json = doc;

    return yawn.yaml;
  } catch (err) {
    logger.info({ err }, 'Error setting new .gitlab-ci.yml include value');
    return null;
  }
}
