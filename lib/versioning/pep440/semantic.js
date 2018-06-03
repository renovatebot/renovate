const pep440 = require('@renovate/pep440');

const major = input => {
  const version = pep440.explain(input);
  if (!version) {
    throw new TypeError('Invalid Version: ' + input);
  }
  return version.release[0];
};

const minor = input => {
  const version = pep440.explain(input);
  if (!version) {
    throw new TypeError('Invalid Version: ' + input);
  }
  if (version.release.length < 2) {
    return 0;
  }
  return version.release[1];
};

// those notation are borrowed from semver, not sure if should be moved to @renovate/pep440
module.exports = {
  major,
  minor,
};
