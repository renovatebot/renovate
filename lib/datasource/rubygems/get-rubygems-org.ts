import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import { getElapsedMinutes } from '../../util/date';
import { Http } from '../../util/http';
import type { ReleaseResult } from '../types';
import { id } from './common';

const http = new Http(id);

let lastSync = new Date('2000-01-01');
let packageReleases: Record<string, string[]> = Object.create(null); // Because we might need a "constructor" key
let contentLength = 0;

// Note: use only for tests
export function resetCache(): void {
  lastSync = new Date('2000-01-01');
  packageReleases = Object.create(null);
  contentLength = 0;
}

/* https://bugs.chromium.org/p/v8/issues/detail?id=2869 */
const copystr = (x: string): string => (' ' + x).slice(1);

async function updateRubyGemsVersions(): Promise<void> {
  const url = 'https://rubygems.org/versions';
  const options = {
    headers: {
      'accept-encoding': 'identity',
      range: `bytes=${contentLength}-`,
    },
  };
  let newLines: string;
  try {
    logger.debug('Rubygems: Fetching rubygems.org versions');
    const startTime = Date.now();
    newLines = (await http.get(url, options)).body;
    const durationMs = Math.round(Date.now() - startTime);
    logger.debug({ durationMs }, 'Rubygems: Fetched rubygems.org versions');
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode !== 416) {
      contentLength = 0;
      packageReleases = Object.create(null); // Because we might need a "constructor" key
      throw new ExternalHostError(
        new Error('Rubygems fetch error - need to reset cache')
      );
    }
    logger.debug('Rubygems: No update');
    lastSync = new Date();
    return;
  }

  function processLine(line: string): void {
    let split: string[];
    let pkg: string;
    let versions: string;
    try {
      const l = line.trim();
      if (!l.length || l.startsWith('created_at:') || l === '---') {
        return;
      }
      split = l.split(' ');
      [pkg, versions] = split;
      pkg = copystr(pkg);
      packageReleases[pkg] = packageReleases[pkg] || [];
      const lineVersions = versions.split(',').map((version) => version.trim());
      for (const lineVersion of lineVersions) {
        if (lineVersion.startsWith('-')) {
          const deletedVersion = lineVersion.slice(1);
          logger.trace({ pkg, deletedVersion }, 'Rubygems: Deleting version');
          packageReleases[pkg] = packageReleases[pkg].filter(
            (version) => version !== deletedVersion
          );
        } else {
          packageReleases[pkg].push(copystr(lineVersion));
        }
      }
    } catch (err) /* istanbul ignore next */ {
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

function isDataStale(): boolean {
  return getElapsedMinutes(lastSync) >= 5;
}

let updateRubyGemsVersionsPromise: Promise<void> | undefined;

async function syncVersions(): Promise<void> {
  if (isDataStale()) {
    updateRubyGemsVersionsPromise =
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      updateRubyGemsVersionsPromise || updateRubyGemsVersions();
    await updateRubyGemsVersionsPromise;
    updateRubyGemsVersionsPromise = null;
  }
}

export async function getRubygemsOrgDependency(
  lookupName: string
): Promise<ReleaseResult | null> {
  logger.debug(`getRubygemsOrgDependency(${lookupName})`);
  await syncVersions();
  if (!packageReleases[lookupName]) {
    return null;
  }
  const dep: ReleaseResult = {
    releases: packageReleases[lookupName].map((version) => ({ version })),
  };
  return dep;
}
