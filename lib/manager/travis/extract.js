import is from '@sindresorhus/is';

const yaml = require('js-yaml');
const { logger } = require('../../logger');

export { extractPackageFile };

function extractPackageFile(content) {
  let doc;
  try {
    doc = yaml.safeLoad(content);
  } catch (err) {
    logger.info({ err }, 'Error while parsing yml.');
  }

  let deps = [];
  if (doc && is.array(doc.node_js)) {
    deps = [
      {
        depName: 'node',
        currentValue: doc.node_js,
      },
    ];
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
