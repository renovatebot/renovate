const semver = require('semver');
const dockerApi = require('../../api/docker');
const versions = require('./versions');
const compareVersions = require('compare-versions');

module.exports = {
  renovateDockerImage,
};

function getSuffix(tag) {
  const split = tag.indexOf('-');
  return split > 0 ? tag.slice(split + 1) : '';
}

function stripSuffix(tag) {
  const split = tag.indexOf('-');
  return split > 0 ? tag.slice(0, split) : tag;
}

function getMatchingTags(tags, currenTag) {
  const currentSuffix = getSuffix(currenTag);
  return tags
    .filter(tag => tag.endsWith(currentSuffix))
    .map(stripSuffix);
}

async function renovateDockerImage(config) {
  // FUTURE: if pinVersions and currentVersion is a range then look for matching semver to pin to
  // FUTURE: if pinVersions and no currentTag then look for maximum semver that has same digest
  // FUTURE: if current tag doesn't exist in registry and currentVersion is valid then look for rollback
  // if current version is valid range or semver then look for matching upgrades
  // if currentDigest or pinDigest then add digest to each result

  const { depName, logger } = config;
  const currentVersion = stripSuffix(config.currentTag);
  if (!versions.isValidVersion(currentVersion)) {
    logger.info({ tag: config.currentTag }, 'Cannot detect semver in docker tag');
    return [];
  }
  const allTags = await dockerApi.getTags(
    depName,
    logger
  );
  if (allTags.length === 0) {
    logger.info({ tag: currentTag }, 'Cannot look up docker tag');
    return [];
  }
  logger.trace({ depName, allTags }, 'All tags');

  const allMatchingTags = getMatchingTags(allTags);
  logger.trace({ depName, allMatchingTags }, 'All matching tags');

  // if pinDigests and no pin result, then add now

  let results = [];

  // Add digests
  results = results.map(result => {
    if (config.currentDigest || config.pinDigests) {
      const newDigest = await dockerApi.getDigest(
        depName,
        upgrade.newTag,
        logger
      );
      return { ...result, newDigest };
    }
    return result;
  }

  for (const result of results) {
    if (config.currentDigest || config.pinDigests) {

    }
  }
  return results;
}
