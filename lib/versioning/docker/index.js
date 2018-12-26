const generic = require('../loose/generic');

function parse(version) {
  const versionPieces = version.replace(/^v/, '').split('-');
  const prefix = versionPieces.shift();
  const suffix = versionPieces.join('-');
  const release = prefix.split('.').map(Number);
  if (release.some(Number.isNaN)) {
    return null;
  }
  return { release, suffix };
}

function valueToVersion(value) {
  // Remove any suffix after '-', e.g. '-alpine'
  return value ? value.split('-')[0] : value;
}

function compare(version1, vervion2) {
  const parsed1 = parse(version1);
  const parsed2 = parse(vervion2);
  // istanbul ignore if
  if (!(parsed1 && parsed2)) {
    return 1;
  }
  const length = Math.max(parsed1.release.length, parsed2.release.length);
  for (let i = 0; i < length; i += 1) {
    const part1 = parsed1.release[i];
    const part2 = parsed2.release[i];
    // shorter is bigger 2.1 > 2.1.1
    if (part1 === undefined) {
      return 1;
    }
    if (part2 === undefined) {
      return -1;
    }
    if (part1 !== part2) {
      return part1 - part2;
    }
  }
  // equals
  return parsed2.suffix.localeCompare(parsed1.suffix);
}

function isCompatible(version, range) {
  const parsed1 = parse(version);
  const parsed2 = parse(range);
  return (
    parsed1.suffix === parsed2.suffix &&
    parsed1.release.length === parsed2.release.length
  );
}

module.exports = {
  ...generic.create({
    parse,
    compare,
  }),
  isCompatible,
  valueToVersion,
};
