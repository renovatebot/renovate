// TODO: types (#22198)
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { detectPlatform } from '../../../util/common';
import * as hostRules from '../../../util/host-rules';
import { Http } from '../../../util/http';
import { regEx } from '../../../util/regex';
import {
  parseUrl,
  trimLeadingSlash,
  trimTrailingSlash,
} from '../../../util/url';
import { BitbucketTagsDatasource } from '../bitbucket-tags';
import { GitTagsDatasource } from '../git-tags';
import { GiteaTagsDatasource } from '../gitea-tags';
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

    //#region known gitea compatible hosts
    if (goModule.startsWith('gitea.com/')) {
      const split = goModule.split('/');
      const packageName = `${split[1]}/${split[2]}`;
      return {
        datasource: GiteaTagsDatasource.id,
        packageName,
        registryUrl: 'https://gitea.com',
      };
    }

    if (goModule.startsWith('code.forgejo.org/')) {
      const split = goModule.split('/');
      const packageName = `${split[1]}/${split[2]}`;
      return {
        datasource: GiteaTagsDatasource.id,
        packageName,
        registryUrl: 'https://code.forgejo.org',
      };
    }

    if (goModule.startsWith('codeberg.org/')) {
      const split = goModule.split('/');
      const packageName = `${split[1]}/${split[2]}`;
      return {
        datasource: GiteaTagsDatasource.id,
        packageName,
        registryUrl: 'https://codeberg.org',
      };
    }
    //#endregion

    return await BaseGoDatasource.goGetDatasource(goModule);
  }

  private static async goGetDatasource(
    goModule: string,
  ): Promise<DataSource | null> {
    const goModuleUrl = goModule.replace(/\.git(\/[a-z0-9/]*)?$/, '');
    const pkgUrl = `https://${goModuleUrl}?go-get=1`;
    const { body: html } = await BaseGoDatasource.http.getText(pkgUrl);

    const goSourceHeader = BaseGoDatasource.goSourceHeader(html, goModule);
    if (goSourceHeader) {
      return goSourceHeader;
    }

    // GitHub Enterprise only returns a go-import meta
    const goImport = BaseGoDatasource.goImportHeader(html, goModule);
    if (goImport) {
      return goImport;
    }

    logger.trace({ goModule }, 'No go-source or go-import header found');
    return null;
  }

  private static goSourceHeader(
    html: string,
    goModule: string,
  ): DataSource | null {
    const sourceMatchGroups = regEx(
      /<meta\s+name="?go-source"?\s+content="(?<prefix>[^"\s]+)\s+(?<goSourceUrl>[^"\s]+)/,
    ).exec(html)?.groups;
    if (!sourceMatchGroups) {
      return null;
    }
    const { prefix, goSourceUrl } = sourceMatchGroups;

    if (!goModule.startsWith(prefix)) {
      logger.trace({ goModule }, 'go-source header prefix not match');
      return null;
    }

    logger.debug(`Go lookup source url ${goSourceUrl} for module ${goModule}`);
    return this.detectDatasource(goSourceUrl, goModule);
  }

  private static detectDatasource(
    metadataUrl: string,
    goModule: string,
  ): DataSource | null {
    if (metadataUrl.startsWith('https://github.com/')) {
      return {
        datasource: GithubTagsDatasource.id,
        packageName: metadataUrl
          .replace('https://github.com/', '')
          .replace(regEx(/\/$/), ''),
        registryUrl: 'https://github.com',
      };
    }

    const gitlabModuleName =
      BaseGoDatasource.gitlabRegExp.exec(goModule)?.groups?.regExpPath;
    const vcsIndicatedModule =
      BaseGoDatasource.gitVcsRegexp.exec(goModule)?.groups?.module;

    const metadataUrlMatchGroups =
      BaseGoDatasource.gitlabHttpsRegExp.exec(metadataUrl)?.groups;
    if (metadataUrlMatchGroups) {
      const { httpsRegExpUrl, httpsRegExpName } = metadataUrlMatchGroups;

      let packageName = vcsIndicatedModule ?? gitlabModuleName;

      // Detect submodules in monorepos by comparing metadata path and module path
      if (!vcsIndicatedModule && httpsRegExpName && gitlabModuleName) {
        const metadataPath = httpsRegExpName;
        const modulePath = gitlabModuleName;

        if (modulePath.startsWith(metadataPath + '/')) {
          packageName = metadataPath;
        }
      }

      // If we still don't have a package name, fall back to the metadata URL path
      packageName = packageName ?? httpsRegExpName;

      return {
        datasource: GitlabTagsDatasource.id,
        registryUrl: httpsRegExpUrl,
        packageName,
      };
    }

    if (hostRules.hostType({ url: metadataUrl }) === 'gitlab') {
      const parsedUrl = parseUrl(metadataUrl);
      if (!parsedUrl) {
        logger.trace({ goModule }, 'Could not parse go-source URL');
        return null;
      }

      const endpoint = GlobalConfig.get('endpoint', '');
      const endpointPrefix = regEx(
        /https:\/\/[^/]+\/(?<prefix>.*?\/)(?:api\/v4\/?)?/,
      ).exec(endpoint)?.groups?.prefix;

      let packageName =
        // a .git path indicates a concrete git repository, which can be different from metadata returned by gitlab
        vcsIndicatedModule ?? trimLeadingSlash(parsedUrl.pathname);
      if (endpointPrefix && endpointPrefix !== 'api/') {
        packageName = packageName.replace(endpointPrefix, '');
      }

      const registryUrl = endpointPrefix
        ? endpoint.replace(regEx(/\/api\/v4\/?$/), '/')
        : `${parsedUrl.protocol}//${parsedUrl.host}`;

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
    html: string,
    goModule: string,
  ): DataSource | null {
    const importMatchGroups = regEx(
      /<meta\s+name="?go-import"?\s+content="(?<prefix>[^"\s]+)\s+(?<proto>[^"\s]+)\s+(?<goImportURL>[^"\s]+)/,
    ).exec(html)?.groups;
    if (!importMatchGroups) {
      logger.trace({ goModule }, 'No go-source or go-import header found');
      return null;
    }
    const { prefix, proto, goImportURL } = importMatchGroups;

    if (!goModule.startsWith(prefix)) {
      logger.trace({ goModule }, 'go-import header prefix not match');
      return null;
    }

    if (proto !== 'git') {
      logger.trace({ goModule }, 'go-import header proto not git');
      return null;
    }

    // get server base url from import url
    const parsedUrl = parseUrl(goImportURL);
    if (!parsedUrl) {
      logger.trace({ goModule }, 'Could not parse go-import URL');
      return null;
    }

    logger.debug(`Go module: ${goModule} lookup import url ${goImportURL}`);

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
