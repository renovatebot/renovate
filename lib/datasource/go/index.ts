import { logger } from '../../logger';
import got from '../../util/got';
import * as github from '../github';
import { DigestConfig, PkgReleaseConfig, ReleaseResult } from '../common';
import { regEx } from '../../util/regex';

interface DataSource {
  datasource: string;
  lookupName: string;
}

async function getDatasource(name: string): Promise<DataSource | null> {
  if (name.startsWith('gopkg.in/')) {
    const [pkg] = name.replace('gopkg.in/', '').split('.');
    if (pkg.includes('/')) {
      return { datasource: 'github', lookupName: pkg };
    }
    return { datasource: 'github', lookupName: `go-${pkg}/${pkg}` };
  }
  if (name.startsWith('github.com/')) {
    const split = name.split('/');
    const lookupName = split[1] + '/' + split[2];
    return {
      datasource: 'github',
      lookupName,
    };
  }
  const pkgUrl = `https://${name}?go-get=1`;
  try {
    const res = (await got(pkgUrl, {
      hostType: 'go',
    })).body;
    const sourceMatch = res.match(
      regEx(`<meta name="go-source" content="${name}\\s+([^\\s]+)`)
    );
    if (sourceMatch) {
      const [, goSourceUrl] = sourceMatch;
      logger.debug({ depName: name, goSourceUrl }, 'Go lookup source url');
      if (goSourceUrl && goSourceUrl.startsWith('https://github.com/')) {
        return {
          datasource: 'github',
          lookupName: goSourceUrl
            .replace('https://github.com/', '')
            .replace(/\/$/, ''),
        };
      }
    } else {
      logger.trace({ depName: name }, 'No go-source header found');
    }
    return null;
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.info({ dependency: name }, `Dependency lookup failure: not found`);
      logger.debug({
        err,
      });
      return null;
    }
    logger.info({ err, name }, 'go lookup failure: Unknown error');
    return null;
  }
}

/**
 * go.getPkgReleases
 *
 * This datasource resolves a go module URL into its source repository
 *  and then fetch it if it is on GitHub.
 *
 * This function will:
 *  - Determine the source URL for the module
 *  - Call the respective getPkgReleases in github to retrieve the tags
 */
export async function getPkgReleases({
  lookupName,
}: Partial<PkgReleaseConfig>): Promise<ReleaseResult | null> {
  logger.trace(`go.getPkgReleases(${lookupName})`);
  const source = await getDatasource(lookupName);
  if (source && source.datasource === 'github') {
    const res = await github.getPkgReleases(source);
    if (res && res.releases) {
      res.releases = res.releases.filter(
        release => release.version && release.version.startsWith('v')
      );
    }
    return res;
  }
  return null;
}

/**
 * go.getDigest
 *
 * This datasource resolves a go module URL into its source repository
 *  and then fetches the digest it if it is on GitHub.
 *
 * This function will:
 *  - Determine the source URL for the module
 *  - Call the respective getDigest in github to retrieve the commit hash
 */
export async function getDigest(
  { lookupName }: Partial<DigestConfig>,
  value?: string
): Promise<string | null> {
  const source = await getDatasource(lookupName);
  if (source && source.datasource === 'github') {
    // ignore v0.0.0- pseudo versions that are used Go Modules - look up default branch instead
    const tag = value && !value.startsWith('v0.0.0-2') ? value : undefined;
    const digest = await github.getDigest(source, tag);
    return digest;
  }
  return null;
}
