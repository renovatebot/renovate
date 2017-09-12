module.exports = {
  renovateDockerImage,
};

async function renovateDockerImage(config) {
  // depName = image name
  // depTag = tag (optional, use 'latest' if missing)
  // depDigest = digest (optional)
  //
  // Query docker registry for image/tag
  // If digest is different then update it
  // If digest existed then upgradeType='digest'
  // else upgradeType='pin'
  return [];
}
