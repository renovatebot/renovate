const _ = require('lodash');
const yaml = require('js-yaml');

module.exports = {
  setNewValue,
};

function getPath(obj, path) {
  if (!path.length) {
    return obj;
  }
  return getPath(obj[path[0]], path.slice(1));
}

function getIndex(content, path, currentIndex = 0) {
  if (!path.length) {
    return currentIndex;
  }
  return getIndex(
    content,
    path.slice(1),
    content.indexOf(path[0], currentIndex)
  );
}

function setNewValue(currentFileContent, upgrade) {
  try {
    logger.debug(`setNewValue: ${upgrade.newFrom}`);
    const doc = yaml.safeLoad(currentFileContent);
    const changedObject = getPath(doc, upgrade.path);
    if (changedObject.image === upgrade.newFrom) {
      logger.debug('Version is already updated');
      return currentFileContent;
    }
    changedObject.image = upgrade.newFrom;
    logger.info({ doc }, 'new doc');
    const replaceIndex = getIndex(currentFileContent, [
      ...upgrade.path,
      'image:',
    ]);
    logger.info({ replaceIndex, file: currentFileContent.slice(replaceIndex) });
    const regexReplace = new RegExp(`(image:\\s*)[^\\n]*`);
    const newFileContent =
      currentFileContent.substring(0, replaceIndex) +
      currentFileContent
        .slice(replaceIndex)
        .replace(regexReplace, `$1${upgrade.newFrom}`);
    logger.info({ newFileContent });
    const newDoc = yaml.safeLoad(newFileContent);
    if (_.isEqual(doc, newDoc)) {
      return newFileContent;
    }
    logger.warn('Failed to update docker compose file');
    return currentFileContent;
  } catch (err) {
    logger.info({ err }, 'Error setting new Dockerfile value');
    return null;
  }
}
