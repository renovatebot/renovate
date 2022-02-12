import URL from 'url';
import { PlatformId } from '../../constants';
import { logger } from '../../logger';
import * as hostRules from '../../util/host-rules';
import { Http } from '../../util/http';
import { regEx } from '../../util/regex';
import { trimTrailingSlash } from '../../util/url';
import { BitBucketTagsDatasource } from '../bitbucket-tags';
import * as github from '../github-tags';
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

  private static readonly id = 'go';
  private static readonly http = new Http(BaseGoDatasource.id);

  static async getDatasource(goModule: string): Promise<DataSource | null> {
    if (goModule.startsWith('gopkg.in/')) {
      const [pkg] = goModule.replace('gopkg.in/', '').split('.');
      const lookupName = pkg.includes('/') ? pkg : `go-${pkg}/${pkg}`;
      return {
        datasource: github.id,
        lookupName,
        registryUrl: 'https://github.com',
      };
    }

    if (goModule.startsWith('github.com/')) {
      const split = goModule.split('/');
      const lookupName = split[1] + '/' + split[2];
      return {
        datasource: github.id,
        lookupName,
        registryUrl: 'https://github.com',
      };
    }

    if (goModule.startsWith('bitbucket.org/')) {
      const split = goModule.split('/');
      const lookupName = split[1] + '/' + split[2];
      return {
        datasource: BitBucketTagsDatasource.id,
        lookupName,
        registryUrl: 'https://bitbucket.org',
      };
    }

    const goGetResult = await BaseGoDatasource.goGetDatasource(goModule);
    return goGetResult;
  }

  private static async goGetDatasource(
    goModule: string
  ): Promise<DataSource | null> {
    const pkgUrl = `https://${goModule}?go-get=1`;
    const res = (await BaseGoDatasource.http.get(pkgUrl)).body;
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
          if (gitlabModuleName.includes('.git')) {
            return {
              datasource: GitlabTagsDatasource.id,
              registryUrl: gitlabUrl,
              lookupName: gitlabModuleName.substring(
                0,
                gitlabModuleName.indexOf('.git')
              ),
            };
          }
          return {
            datasource: GitlabTagsDatasource.id,
            registryUrl: gitlabUrl,
            lookupName: gitlabModuleName,
          };
        }

        return {
          datasource: GitlabTagsDatasource.id,
          registryUrl: gitlabUrl,
          lookupName: gitlabUrlName,
        };
      }

      const opts = hostRules.find({
        hostType: PlatformId.Gitlab,
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
          datasource: GitlabTagsDatasource.id,
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
          .replace(regEx(/\.git$/), '')
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
}
