import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as hostRules from '../../util/host-rules';
import { Http } from '../../util/http';
import { ensureTrailingSlash } from '../../util/url';
import { ReleaseResult } from '../common';
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

async function updateGemVersions(registryUrl: string): Promise<void> {
  const url = `${ensureTrailingSlash(registryUrl)}versions`;

  const { token } = hostRules.find({
    hostType: 'bundler',
    url: ensureTrailingSlash(registryUrl),
  });

  const options = {
    headers: {
      'accept-encoding': 'identity',
      range: `bytes=${contentLength}-`,
    },
    ...(token && { username: token, password: '' }),
  };

  let newLines: string;
  try {
    logger.debug(`Rubygems: Fetching ${url}`);
    const startTime = Date.now();
    newLines = (await http.get(url, options)).body;
    const durationMs = Math.round(Date.now() - startTime);
    logger.debug({ durationMs }, `Rubygems: Fetched ${url}`);
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 403) {
      throw new ExternalHostError(
        new Error(
          `Rubygems fetch error - failed to fetch ${url} with status code 403`
        )
      );
    }

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
  const minutesElapsed = Math.floor(
    (new Date().getTime() - lastSync.getTime()) / (60 * 1000)
  );
  return minutesElapsed >= 5;
}

let _updateGemVersions: Promise<void> | undefined;

async function syncVersions(registryUrl): Promise<void> {
  if (isDataStale()) {
    _updateGemVersions =
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      _updateGemVersions || updateGemVersions(registryUrl);
    await _updateGemVersions;
    _updateGemVersions = null;
  }
}

export async function getDependencyGem({
  dependency,
  registry,
}): Promise<ReleaseResult | null> {
  logger.debug(`getGemDependency(${dependency}, ${registry})`);
  await syncVersions(registry);
  if (!packageReleases[dependency]) {
    return null;
  }
  const dep: ReleaseResult = {
    name: dependency,
    releases: packageReleases[dependency].map((version) => ({ version })),
  };
  return dep;
}
