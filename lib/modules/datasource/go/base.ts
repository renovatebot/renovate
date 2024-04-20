// TODO: types (#22198)
import URL from 'node:url';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { detectPlatform } from '../../../util/common';
import * as hostRules from '../../../util/host-rules';
import { Http } from '../../../util/http';
import { regEx } from '../../../util/regex';
import { trimLeadingSlash, trimTrailingSlash } from '../../../util/url';
import { BitbucketTagsDatasource } from '../bitbucket-tags';
import { GitTagsDatasource } from '../git-tags';
import { GithubTagsDatasource } from '../github-tags';
import { GitlabTagsDatasource } from '../gitlab-tags';
import type { DataSource } from './types';

// TODO: figure out class hierarchy (#10532)
export class BaseGoDatasource {
  private static readonly gitlabHttpsRegExp = regEx(
    /^(?<httpsRegExpUrl>https:\/\/[^/]*gitlab\.[^/]*)\/(?<httpsRegExpName>.+?)(?:\/v\d+)?[/]?$/,
  );
  private static readonly gitlabRegExp = regEx(
    /^(?<regExpUrl>gitlab\.[^/]*)\/(?<regExpPath>.+?)(?:\/v\d+)?[/]?$/,
  );
  private static readonly gitVcsRegexp = regEx(
    /^(?:[^/]+)\/(?<module>.*)\.git(?:$|\/)/,
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
        datasource: BitbucketTagsDatasource.id,
        packageName,
        registryUrl: 'https://bitbucket.org',
      };
    }

    if (goModule.startsWith('code.cloudfoundry.org/')) {
      const packageName = goModule.replace(
        'code.cloudfoundry.org',
        'cloudfoundry',
      );
      return {
        datasource: GithubTagsDatasource.id,
        packageName,
        registryUrl: 'https://github.com',
      };
    }

    if (goModule.startsWith('dev.azure.com/')) {
      const split = goModule.split('/');
      if ((split.length > 4 && split[3] === '_git') || split.length > 3) {
        const packageName =
          'https://dev.azure.com/' +
          split[1] +
          '/' +
          split[2] +
          '/_git/' +
          (split[3] === '_git' ? split[4] : split[3]).replace(
            regEx(/\.git$/),
            '',
          );
        return {
          datasource: GitTagsDatasource.id,
          packageName,
        };
      }
    }

    return await BaseGoDatasource.goGetDatasource(goModule);
  }

  private static async goGetDatasource(
    goModule: string,
  ): Promise<DataSource | null> {
    const goModuleUrl = goModule.replace(/\.git\/v2$/, '');
    const pkgUrl = `https://${goModuleUrl}?go-get=1`;
    // GitHub Enterprise only returns a go-import meta
    const res = (await BaseGoDatasource.http.get(pkgUrl)).body;
    return (
      BaseGoDatasource.goSourceHeader(res, goModule) ??
      BaseGoDatasource.goImportHeader(res, goModule)
    );
  }

  private static goSourceHeader(
    res: string,
    goModule: string,
  ): DataSource | null {
    const sourceMatch = regEx(
      `<meta\\s+name="?go-source"?\\s+content="([^\\s]+)\\s+([^\\s]+)`,
    ).exec(res);
    if (!sourceMatch) {
      return null;
    }
    const [, prefix, goSourceUrl] = sourceMatch;
    if (!goModule.startsWith(prefix)) {
      logger.trace({ goModule }, 'go-source header prefix not match');
      return null;
    }
    logger.debug(`Go lookup source url ${goSourceUrl} for module ${goModule}`);
    return this.detectDatasource(goSourceUrl, goModule);
  }

  private static detectDatasource(
    goSourceUrl: string,
    goModule: string,
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

    if (hostRules.hostType({ url: goSourceUrl }) === 'gitlab') {
      // get server base url from import url
      const parsedUrl = URL.parse(goSourceUrl);

      // TODO: `parsedUrl.pathname` can be undefined
      let packageName = trimLeadingSlash(`${parsedUrl.pathname}`);

      const endpoint = GlobalConfig.get('endpoint')!;

      const endpointPrefix = regEx('https://[^/]*/(.*?/)(api/v4/?)?').exec(
        endpoint,
      );

      if (endpointPrefix && endpointPrefix[1] !== 'api/') {
        packageName = packageName.replace(endpointPrefix[1], '');
      }

      const registryUrl = endpointPrefix
        ? endpoint.replace(regEx('api/v4/?$'), '')
        : `${parsedUrl.protocol}//${parsedUrl.host}`;

      // a .git path indicates a concrete git repository, which can be different from metadata returned by gitlab
      const vcsIndicatedModule = BaseGoDatasource.gitVcsRegexp.exec(goModule);
      if (vcsIndicatedModule?.groups?.module) {
        if (endpointPrefix) {
          packageName = vcsIndicatedModule.groups?.module.replace(
            endpointPrefix[1],
            '',
          );
        } else {
          packageName = vcsIndicatedModule.groups?.module;
        }
        return {
          datasource: GitlabTagsDatasource.id,
          registryUrl,
          packageName,
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
    goModule: string,
  ): DataSource | null {
    const importMatch = regEx(
      `<meta\\s+name="?go-import"?\\s+content="([^\\s]+)\\s+([^\\s]+)\\s+([^\\s]+)"\\s*\\/?>`,
    ).exec(res);

    if (!importMatch) {
      logger.trace({ goModule }, 'No go-source or go-import header found');
      return null;
    }

    const [, prefix, proto, goImportURL] = importMatch;
    if (!goModule.startsWith(prefix)) {
      logger.trace({ goModule }, 'go-import header prefix not match');
      return null;
    }

    if (proto !== 'git') {
      logger.trace({ goModule }, 'go-import header proto not git');
      return null;
    }

    logger.debug(`Go module: ${goModule} lookup import url ${goImportURL}`);
    // get server base url from import url
    const parsedUrl = URL.parse(goImportURL);

    const datasource = this.detectDatasource(
      goImportURL.replace(regEx(/\.git$/), ''),
      goModule,
    );
    if (datasource !== null) {
      return datasource;
    }
    // fall back to old behavior if detection did not work

    switch (detectPlatform(goImportURL)) {
      case 'github': {
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
      case 'azure': {
        return {
          datasource: GitTagsDatasource.id,
          packageName: goImportURL.replace(regEx(/\.git$/), ''),
        };
      }
      default: {
        return {
          datasource: GitTagsDatasource.id,
          packageName: goImportURL,
        };
      }
    }
  }
}
