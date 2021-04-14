import URL from 'url';
import { PLATFORM_TYPE_GITLAB } from '../../constants/platforms';
import { logger } from '../../logger';
import * as hostRules from '../../util/host-rules';
import { Http } from '../../util/http';
import { regEx } from '../../util/regex';
import { trimTrailingSlash } from '../../util/url';
import * as bitbucket from '../bitbucket-tags';
import * as github from '../github-tags';
import * as gitlab from '../gitlab-tags';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';

export const id = 'go';
export const customRegistrySupport = false;

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

  if (goModule.startsWith('bitbucket.org/')) {
    const split = goModule.split('/');
    const lookupName = split[1] + '/' + split[2];
    return {
      datasource: bitbucket.id,
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

    const opts = hostRules.find({
      hostType: PLATFORM_TYPE_GITLAB,
      url: goSourceUrl,
    });
    if (opts.token) {
      // get server base url from import url
      const parsedUrl = URL.parse(goSourceUrl);

      // split the go module from the URL: host/go/module -> go/module
      const split = goModule.split('/');
      const lookupName = split[1] + '/' + split[2];

      const registryUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

      return {
        datasource: gitlab.id,
        registryUrl,
        lookupName,
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
      const lookupName = trimTrailingSlash(parsedUrl.pathname)
        .replace(/\.git$/, '')
        .split('/')
        .slice(-2)
        .join('/');

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

  if (!source) {
    logger.warn({ lookupName }, 'Unsupported dependency.');
    return null;
  }

  let res: ReleaseResult;

  switch (source.datasource) {
    case github.id: {
      res = await github.getReleases(source);
      break;
    }
    case gitlab.id: {
      res = await gitlab.getReleases(source);
      break;
    }
    case bitbucket.id: {
      res = await bitbucket.getReleases(source);
      break;
    }
    /* istanbul ignore next: can never happen, makes lint happy */
    default: {
      return null;
    }
  }

  // istanbul ignore if
  if (!res) {
    return null;
  }

  /**
   * github.com/org/mod/submodule should be tagged as submodule/va.b.c
   * and that tag should be used instead of just va.b.c, although for compatibility
   * the old behaviour stays the same.
   */
  const nameParts = lookupName.replace(/\/v\d+$/, '').split('/');
  logger.trace({ nameParts, releases: res.releases }, 'go.getReleases');

  // If it has more than 3 parts it's a submodule
  if (nameParts.length > 3) {
    const prefix = nameParts.slice(3, nameParts.length).join('/');
    logger.trace(`go.getReleases.prefix:${prefix}`);

    // Filter the releases so that we only get the ones that are for this submodule
    // Also trim the submodule prefix from the version number
    const submodReleases = res.releases
      .filter((release) => release.version?.startsWith(prefix))
      .map((release) => {
        const r2 = release;
        r2.version = r2.version.replace(`${prefix}/`, '');
        return r2;
      });
    logger.trace({ submodReleases }, 'go.getReleases');

    return {
      sourceUrl: res.sourceUrl,
      releases: submodReleases,
    };
  }

  if (res.releases) {
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
  if (!source) {
    return null;
  }

  // ignore v0.0.0- pseudo versions that are used Go Modules - look up default branch instead
  const tag = value && !value.startsWith('v0.0.0-2') ? value : undefined;

  switch (source.datasource) {
    case github.id: {
      return github.getDigest(source, tag);
    }
    case bitbucket.id: {
      return bitbucket.getDigest(source, tag);
    }
    /* istanbul ignore next: can never happen, makes lint happy */
    default: {
      return null;
    }
  }
}
