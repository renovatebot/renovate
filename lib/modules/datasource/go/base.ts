// TODO: types (#7154)
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import URL from 'url';
import { PlatformId } from '../../../constants';
import { logger } from '../../../logger';
import * as hostRules from '../../../util/host-rules';
import { Http } from '../../../util/http';
import { regEx } from '../../../util/regex';
import { trimLeadingSlash, trimTrailingSlash } from '../../../util/url';
import { BitBucketTagsDatasource } from '../bitbucket-tags';
import { GithubTagsDatasource } from '../github-tags';
import { GitlabTagsDatasource } from '../gitlab-tags';
import type { DataSource } from './types';

// TODO: figure out class hierarchy (#10532)
export class BaseGoDatasource {
  private static readonly gitlabHttpsRegExp = regEx(
    /^(?<httpsRegExpUrl>https:\/\/[^/]*gitlab\.[^/]*)\/(?<httpsRegExpName>.+?)(?:\/v\d+)?[/]?$/
  );
  private static readonly gitlabRegExp = regEx(
    /^(?<regExpUrl>gitlab\.[^/]*)\/(?<regExpPath>.+?)(?:\/v\d+)?[/]?$/
  );
  private static readonly gitVcsRegexp = regEx(
    /^(?:[^/]+)\/(?<module>.*)\.git(?:$|\/)/
  );

  private static readonly id = 'go';
  private static readonly http = new Http(BaseGoDatasource.id);

  static async getDatasource(goModule: string): Promise<DataSource | null> {
    if (goModule.startsWith('gopkg.in/')) {
      const [pkg] = goModule.replace('gopkg.in/', '').split('.');
      const packageName = pkg.includes('/') ? pkg : `go-${pkg}/${pkg}`;
      return {
        datasource: GithubTagsDatasource.id,
        packageName,
        registryUrl: 'https://github.com',
      };
    }

    if (goModule.startsWith('github.com/')) {
      const split = goModule.split('/');
      const packageName = split[1] + '/' + split[2];
      return {
        datasource: GithubTagsDatasource.id,
        packageName,
        registryUrl: 'https://github.com',
      };
    }

    if (goModule.startsWith('bitbucket.org/')) {
      const split = goModule.split('/');
      const packageName = split[1] + '/' + split[2];
      return {
        datasource: BitBucketTagsDatasource.id,
        packageName,
        registryUrl: 'https://bitbucket.org',
      };
    }

    return await BaseGoDatasource.goGetDatasource(goModule);
  }

  private static async goGetDatasource(
    goModule: string
  ): Promise<DataSource | null> {
    const pkgUrl = `https://${goModule}?go-get=1`;
    // GitHub Enterprise only returns a go-import meta
    const res = (await BaseGoDatasource.http.get(pkgUrl)).body;
    return (
      BaseGoDatasource.goSourceHeader(res, goModule) ??
      BaseGoDatasource.goImportHeader(res, goModule)
    );
  }

  private static goSourceHeader(
    res: string,
    goModule: string
  ): DataSource | null {
    const sourceMatch = regEx(
      `<meta\\s+name="?go-source"?\\s+content="([^\\s]+)\\s+([^\\s]+)`
    ).exec(res);
    if (!sourceMatch) {
      return null;
    }
    const [, prefix, goSourceUrl] = sourceMatch;
    if (!goModule.startsWith(prefix)) {
      logger.trace({ goModule }, 'go-source header prefix not match');
      return null;
    }
    logger.debug({ goModule, goSourceUrl }, 'Go lookup source url');
    return this.detectDatasource(goSourceUrl, goModule);
  }

  private static detectDatasource(
    goSourceUrl: string,
    goModule: string
  ): DataSource | null {
    if (goSourceUrl?.startsWith('https://github.com/')) {
      return {
        datasource: GithubTagsDatasource.id,
        packageName: goSourceUrl
          .replace('https://github.com/', '')
          .replace(regEx(/\/$/), ''),
        registryUrl: 'https://github.com',
      };
    }
    const gitlabUrl =
      BaseGoDatasource.gitlabHttpsRegExp.exec(goSourceUrl)?.groups
        ?.httpsRegExpUrl;
    const gitlabUrlName =
      BaseGoDatasource.gitlabHttpsRegExp.exec(goSourceUrl)?.groups
        ?.httpsRegExpName;
    const gitlabModuleName =
      BaseGoDatasource.gitlabRegExp.exec(goModule)?.groups?.regExpPath;
    if (gitlabUrl && gitlabUrlName) {
      if (gitlabModuleName?.startsWith(gitlabUrlName)) {
        const vcsIndicatedModule = BaseGoDatasource.gitVcsRegexp.exec(goModule);
        if (vcsIndicatedModule?.groups?.module) {
          return {
            datasource: GitlabTagsDatasource.id,
            registryUrl: gitlabUrl,
            packageName: vcsIndicatedModule.groups?.module,
          };
        }
        return {
          datasource: GitlabTagsDatasource.id,
          registryUrl: gitlabUrl,
          packageName: gitlabModuleName,
        };
      }

      return {
        datasource: GitlabTagsDatasource.id,
        registryUrl: gitlabUrl,
        packageName: gitlabUrlName,
      };
    }

    const opts = hostRules.find({
      hostType: PlatformId.Gitlab,
      url: goSourceUrl,
    });
    if (opts.token) {
      // get server base url from import url
      const parsedUrl = URL.parse(goSourceUrl);

      // TODO: `parsedUrl.pathname` can be undefined
      const packageName = trimLeadingSlash(`${parsedUrl.pathname}`);

      const registryUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

      // a .git path indicates a concrete git repository, which can be different from metadata returned by gitlab
      const vcsIndicatedModule = BaseGoDatasource.gitVcsRegexp.exec(goModule);
      if (vcsIndicatedModule?.groups?.module) {
        return {
          datasource: GitlabTagsDatasource.id,
          registryUrl,
          packageName: vcsIndicatedModule.groups?.module,
        };
      }

      return {
        datasource: GitlabTagsDatasource.id,
        registryUrl,
        packageName,
      };
    }
    /* istanbul ignore next */
    return null;
  }

  private static goImportHeader(
    res: string,
    goModule: string
  ): DataSource | null {
    const importMatch = regEx(
      `<meta\\s+name="?go-import"?\\s+content="([^\\s]+)\\s+([^\\s]+)\\s+([^\\s]+)">`
    ).exec(res);

    if (!importMatch) {
      logger.trace({ goModule }, 'No go-source or go-import header found');
      return null;
    }

    const [, prefix, , goImportURL] = importMatch;
    if (!goModule.startsWith(prefix)) {
      logger.trace({ goModule }, 'go-import header prefix not match');
      return null;
    }

    logger.debug({ goModule, goImportURL }, 'Go lookup import url');
    // get server base url from import url
    const parsedUrl = URL.parse(goImportURL);

    const datasource = this.detectDatasource(
      goImportURL.replace(regEx(/\.git$/), ''),
      goModule
    );
    if (datasource !== null) {
      return datasource;
    }
    // fall back to old behaviour if detection did not work

    // split the go module from the URL: host/go/module -> go/module
    // TODO: `parsedUrl.pathname` can be undefined
    const packageName = trimTrailingSlash(`${parsedUrl.pathname}`)
      .replace(regEx(/\.git$/), '')
      .split('/')
      .slice(-2)
      .join('/');

    return {
      datasource: GithubTagsDatasource.id,
      registryUrl: `${parsedUrl.protocol}//${parsedUrl.host}`,
      packageName,
    };
  }
}
