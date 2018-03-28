const yaml = require('js-yaml');

module.exports = {
  extractDependencies,
  getImages,
};

function isObject(obj) {
  return Object.prototype.toString.call(obj) === '[object Object]';
}

function getImages(obj, path = []) {
  let images = [];
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'image') {
      images.push({ path, val });
    } else if (isObject(val)) {
      images = images.concat(getImages(val, [...path, key]));
    }
  }
  return images;
}

function extractDependencies(content) {
  logger.debug('docker-compose.extractDependencies()');
  const deps = [];
  const doc = yaml.safeLoad(content);
  logger.trace({ doc });
  const images = getImages(doc);
  logger.debug({ images });
  if (!images.length) {
    logger.warn({ content }, 'No images found');
    return [];
  }
  logger.debug({ images }, 'Found matches');
  images.forEach(image => {
    let dockerRegistry;
    const split = image.val.split('/');
    if (split.length > 1 && split[0].includes('.')) {
      [dockerRegistry] = split;
      split.shift();
    }
    const currentDepTagDigest = split.join('/');
    const [currentDepTag, currentDigest] = currentDepTagDigest.split('@');
    const [depName, currentTag] = currentDepTag.split(':');
    logger.info(
      { dockerRegistry, depName, currentTag, currentDigest },
      'Docker Compose image'
    );
    deps.push({
      depType: 'Docker Compose',
      path: image.path,
      currentFrom: image.val,
      currentDepTagDigest,
      dockerRegistry,
      currentDepTag,
      currentDigest,
      depName,
      currentTag,
    });
  });
  return deps;
}
