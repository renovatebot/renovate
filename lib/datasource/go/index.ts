import URL from 'url';
import { logger } from '../../logger';
import { Http } from '../../util/http';
import { regEx } from '../../util/regex';
import { DigestConfig, GetReleasesConfig, ReleaseResult } from '../common';
import * as github from '../github-tags';
import * as gitlab from '../gitlab-tags';

export const id = 'go';

const http = new Http(id);
const gitlabRegExp = /^(https:\/\/[^/]*gitlab.[^/]*)\/(.*)$/;

interface DataSource {
  datasource: string;
  registryUrl?: string;
  lookupName: string;
}

async function getDatasource(goModule: string): Promise<DataSource | null> {
  if (goModule.startsWith('gopkg.in/')) {
    const [pkg] = goModule.replace('gopkg.in/', '').split('.');
    if (pkg.includes('/')) {
      return { datasource: github.id, lookupName: pkg };
    }
    return {
      datasource: github.id,
      lookupName: `go-${pkg}/${pkg}`,
    };
  }
  if (goModule.startsWith('github.com/')) {
    const split = goModule.split('/');
    const lookupName = split[1] + '/' + split[2];
    return {
      datasource: github.id,
      lookupName,
    };
  }

  const pkgUrl = `https://${goModule}?go-get=1`;
  const res = (await http.get(pkgUrl)).body;
  const sourceMatch = regEx(
    `<meta\\s+name="go-source"\\s+content="([^\\s]+)\\s+([^\\s]+)`
  ).exec(res);
  if (sourceMatch) {
    const [, prefix, goSourceUrl] = sourceMatch;
    if (!goModule.startsWith(prefix)) {
      logger.trace({ goModule }, 'go-source header prefix not match');
      return null;
    }
    logger.debug({ goModule, goSourceUrl }, 'Go lookup source url');
    if (goSourceUrl?.startsWith('https://github.com/')) {
      return {
        datasource: github.id,
        lookupName: goSourceUrl
          .replace('https://github.com/', '')
          .replace(/\/$/, ''),
      };
    }
    const gitlabRes = gitlabRegExp.exec(goSourceUrl);
    if (gitlabRes) {
      return {
        datasource: gitlab.id,
        registryUrl: gitlabRes[1],
        lookupName: gitlabRes[2].replace(/\/$/, ''),
      };
    }
  } else {
    // GitHub Enterprise only returns a go-import meta
    const importMatch = regEx(
      `<meta\\s+name="go-import"\\s+content="([^\\s]+)\\s+([^\\s]+)\\s+([^\\s]+)">`
    ).exec(res);
    if (importMatch) {
      const [, prefix, , goImportURL] = importMatch;
      if (!goModule.startsWith(prefix)) {
        logger.trace({ goModule }, 'go-import header prefix not match');
        return null;
      }
      logger.debug({ goModule, goImportURL }, 'Go lookup import url');

      // get server base url from import url
      const parsedUrl = URL.parse(goImportURL);

      // split the go module from the URL: host/go/module -> go/module
      const split = goModule.split('/');
      const lookupName = split[1] + '/' + split[2];

      return {
        datasource: github.id,
        registryUrl: `${parsedUrl.protocol}//${parsedUrl.host}`,
        lookupName,
      };
    }

    logger.trace({ goModule }, 'No go-source or go-import header found');
  }
  return null;
}

/**
 * go.getReleases
 *
 * This datasource resolves a go module URL into its source repository
 *  and then fetch it if it is on GitHub.
 *
 * This function will:
 *  - Determine the source URL for the module
 *  - Call the respective getReleases in github/gitlab to retrieve the tags
 *  - Filter module tags according to the module path
 */
export async function getReleases({
  lookupName,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  logger.trace(`go.getReleases(${lookupName})`);
  const source = await getDatasource(lookupName);
  if (source?.datasource !== github.id && source?.datasource !== gitlab.id) {
    return null;
  }
  const res =
    source.datasource === github.id
      ? await github.getReleases(source)
      : await gitlab.getReleases(source);
  // istanbul ignore if
  if (!res) {
    return res;
  }
  /**
   * github.com/org/mod/submodule should be tagged as submodule/va.b.c
   * and that tag should be used instead of just va.b.c, although for compatibility
   * the old behaviour stays the same.
   */
  const nameParts = lookupName.split('/');
  logger.trace({ nameParts, releases: res.releases }, 'go.getReleases');
  if (nameParts.length > 3) {
    const prefix = nameParts.slice(3, nameParts.length).join('/');
    logger.trace(`go.getReleases.prefix:${prefix}`);
    const submodReleases = res.releases
      .filter((release) => release.version?.startsWith(prefix))
      .map((release) => {
        const r2 = release;
        r2.version = r2.version.replace(`${prefix}/`, '');
        return r2;
      });
    logger.trace({ submodReleases }, 'go.getReleases');
    if (submodReleases.length > 0) {
      return {
        sourceUrl: res.sourceUrl,
        releases: submodReleases,
      };
    }
  }
  if (res?.releases) {
    res.releases = res.releases.filter((release) =>
      release.version?.startsWith('v')
    );
  }
  return res;
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
  if (source && source.datasource === github.id) {
    // ignore v0.0.0- pseudo versions that are used Go Modules - look up default branch instead
    const tag = value && !value.startsWith('v0.0.0-2') ? value : undefined;
    const digest = await github.getDigest(source, tag);
    return digest;
  }
  return null;
}
