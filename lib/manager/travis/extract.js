import is from '@sindresorhus/is';

const { logger } = require('../../logger');
const yaml = require('js-yaml');

export { extractPackageFile };

function extractPackageFile(content) {
  let doc;
  try {
    doc = yaml.safeLoad(content);
  } catch (err) {
    logger.warn({ err, content }, 'Failed to parse .travis.yml file.');
    return null;
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
