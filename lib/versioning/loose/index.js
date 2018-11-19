const generic = require('./generic');

const pattern = /^v?(\d+(?:\.\d+)*)(.*)$/;

function parse(version) {
  const matches = pattern.exec(version);
  if (!matches) {
    return null;
  }
  const [, prefix, suffix] = matches;
  const release = prefix.split('.').map(Number);
  if (release.length > 6) {
    return null;
  }
  return { release, suffix: suffix || '' };
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
    // shorter is smaller 2.1 < 2.1.0
    if (part1 === undefined) {
      return -1;
    }
    if (part2 === undefined) {
      return 1;
    }
    if (part1 !== part2) {
      return part1 - part2;
    }
  }
  // equals
  return parsed1.suffix.localeCompare(parsed2.suffix);
}

module.exports = generic.create({
  parse,
  compare,
});
