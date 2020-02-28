import { logger } from '../../logger';
import got from '../../util/got';
import * as github from '../github-tags';
import { DigestConfig, GetReleasesConfig, ReleaseResult } from '../common';
import { regEx } from '../../util/regex';
import {
  DATASOURCE_GITHUB_TAGS,
  DATASOURCE_GO,
} from '../../constants/data-binary-source';

interface DataSource {
  datasource: string;
  lookupName: string;
}

async function getDatasource(goModule: string): Promise<DataSource | null> {
  if (goModule.startsWith('gopkg.in/')) {
    const [pkg] = goModule.replace('gopkg.in/', '').split('.');
    if (pkg.includes('/')) {
      return { datasource: DATASOURCE_GITHUB_TAGS, lookupName: pkg };
    }
    return {
      datasource: DATASOURCE_GITHUB_TAGS,
      lookupName: `go-${pkg}/${pkg}`,
    };
  }
  if (goModule.startsWith('github.com/')) {
    const split = goModule.split('/');
    const lookupName = split[1] + '/' + split[2];
    return {
      datasource: DATASOURCE_GITHUB_TAGS,
      lookupName,
    };
  }
  const pkgUrl = `https://${goModule}?go-get=1`;
  try {
    const res = (
      await got(pkgUrl, {
        context: { hostType: DATASOURCE_GO },
      })
    ).body;
    const sourceMatch = regEx(
      `<meta\\s+name="go-source"\\s+content="${goModule}\\s+([^\\s]+)`
    ).exec(res);
    if (sourceMatch) {
      const [, goSourceUrl] = sourceMatch;
      logger.debug({ goModule, goSourceUrl }, 'Go lookup source url');
      if (goSourceUrl && goSourceUrl.startsWith('https://github.com/')) {
        return {
          datasource: DATASOURCE_GITHUB_TAGS,
          lookupName: goSourceUrl
            .replace('https://github.com/', '')
            .replace(/\/$/, ''),
        };
      }
    } else {
      logger.trace({ goModule }, 'No go-source header found');
    }
    return null;
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.debug(
        { dependency: goModule },
        `Dependency lookup failure: not found`
      );
      logger.debug({
        err,
      });
      return null;
    }
    logger.debug({ err, goModule }, 'go lookup failure: Unknown error');
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
}: Partial<GetReleasesConfig>): Promise<ReleaseResult | null> {
  logger.trace(`go.getPkgReleases(${lookupName})`);
  const source = await getDatasource(lookupName);
  if (source && source.datasource === DATASOURCE_GITHUB_TAGS) {
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
  if (source && source.datasource === DATASOURCE_GITHUB_TAGS) {
    // ignore v0.0.0- pseudo versions that are used Go Modules - look up default branch instead
    const tag = value && !value.startsWith('v0.0.0-2') ? value : undefined;
    const digest = await github.getDigest(source, tag);
    return digest;
  }
  return null;
}
