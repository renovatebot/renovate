const got = require('got');

module.exports = {
  getRubygemsOrgDependency,
};

let lastSync = new Date('2000-01-01');
let packageReleases = Object.create(null); // Because we might need a "constructor" key
let contentLength = 0;

async function updateRubyGemsVersions() {
  const url = 'https://rubygems.org/versions';
  const options = {
    headers: {
      'accept-encoding': 'identity',
      range: `bytes=${contentLength}-`,
    },
  };
  let newLines;
  try {
    logger.debug('Rubygems: Fetching rubygems.org versions');
    newLines = (await got(url, options)).body;
  } catch (err) {
    if (err.statusCode === 416) {
      logger.debug('Rubygems: No update');
    } else {
      logger.warn({ err }, 'Rubygems error - resetting cache');
      contentLength = 0;
      packageReleases = Object.create(null); // Because we might need a "constructor" key
    }
    lastSync = new Date();
    return;
  }

  function processLine(line) {
    let split;
    let pkg;
    let versions;
    try {
      const l = line.trim();
      if (!l.length || l.startsWith('created_at:') || l === '---') {
        return;
      }
      split = l.split(' ');
      [pkg, versions] = split;
      packageReleases[pkg] = packageReleases[pkg] || [];
      const lineVersions = versions.split(',').map(version => version.trim());
      for (const lineVersion of lineVersions) {
        if (lineVersion.startsWith('-')) {
          const deletedVersion = lineVersion.slice(1);
          logger.trace({ pkg, deletedVersion }, 'Rubygems: Deleting version');
          packageReleases[pkg] = packageReleases[pkg].filter(
            version => version !== deletedVersion
          );
        } else {
          packageReleases[pkg].push(lineVersion);
        }
      }
    } catch (err) {
      logger.warn(
        { err, line, split, pkg, versions },
        'Rubygems line parsing error'
      );
    }
  }

  for (const line of newLines.split('\n')) {
    processLine(line);
  }
  lastSync = new Date();
}

function isDataStale() {
  const minutesElapsed = Math.floor((new Date() - lastSync) / (60 * 1000));
  return minutesElapsed >= 5;
}

async function syncVersions() {
  if (isDataStale()) {
    global.updateRubyGemsVersions =
      global.updateRubyGemsVersions || updateRubyGemsVersions();
    await global.updateRubyGemsVersions;
  }
}

async function getRubygemsOrgDependency(lookupName) {
  await syncVersions();
  if (!packageReleases[lookupName]) {
    return null;
  }
  const dep = {
    name: lookupName,
    releases: packageReleases[lookupName].map(version => ({ version })),
  };
  return dep;
}
