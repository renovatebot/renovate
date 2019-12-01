import * as hostedGitInfo from 'hosted-git-info';
import parse from 'github-url-from-git';
import URL from 'url';
import { logger } from '../logger';
import { addMetaData } from './metadata';
import * as versioning from '../versioning';

import * as cargo from './cargo';
import * as dart from './dart';
import * as docker from './docker';
import * as hex from './hex';
import * as github from './github';
import * as gitlab from './gitlab';
import * as gitTags from './git-tags';
import * as go from './go';
import * as gradleVersion from './gradle-version';
import * as helm from './helm';
import * as maven from './maven';
import * as npm from './npm';
import * as nuget from './nuget';
import * as orb from './orb';
import * as packagist from './packagist';
import * as pypi from './pypi';
import * as rubygems from './rubygems';
import * as rubyVersion from './ruby-version';
import * as sbt from './sbt';
import * as terraform from './terraform';
import * as hostRules from '../util/host-rules';
import {
  Datasource,
  PkgReleaseConfig,
  Release,
  ReleaseResult,
  DigestConfig,
} from './common';

export * from './common';
const cacheNamespace = 'datasource-releases';
const datasources: Record<string, Datasource> = {
  cargo,
  dart,
  docker,
  helm,
  hex,
  github,
  gitlab,
  gitTags,
  go,
  gradleVersion,
  maven,
  npm,
  nuget,
  orb,
  packagist,
  pypi,
  rubygems,
  rubyVersion,
  sbt,
  terraform,
};

export function baseUrlLegacyMassager(sourceUrl: string): string {
  let url: string = sourceUrl.trim();

  if (url.startsWith('git@')) {
    url = 'ssh://' + url; // workaround for https://github.com/npm/hosted-git-info/issues/56
  }
  const parsedUrl = URL.parse(url);
  const extraBaseUrls = [];
  const getHostsFromRulesGithub = hostRules.hosts({ hostType: 'github' }) || [];
  // istanbul ignore if
  if (
    getHostsFromRulesGithub.includes(parsedUrl.hostname) ||
    (parsedUrl.hostname &&
      (parsedUrl.hostname === 'github.com' ||
        parsedUrl.hostname === 'www.github.com'))
  ) {
    // istanbul ignore if
    if (url.startsWith('git:github.com/')) {
      // github-url-from-git does not process git: without the forward slashes.Neither the help pages for git pull/push nor the git extended documentation on protocols specify that as a valid url. Was this related to some package-specific logic, e.g. npm returns the git url without the initial slashes after the protocol?
      url = 'https://' + url.substr(4);
    }
    // Massage www out of github URL
    url = url.replace('www.github.com', 'github.com');
    // istanbul ignore if
    if (url.startsWith('http://github.com/')) {
      url = 'https://' + url.substr(7);
    }
    //  istanbul ignore if
    if (url.startsWith('https://github.com/')) {
      url = url
        .split('/')
        .slice(0, 5)
        .join('/');
    } // a lot of this is probably redundant and can be better achieved with URL
    if (
      getHostsFromRulesGithub === undefined ||
      !getHostsFromRulesGithub.includes(URL.parse(url).hostname)
    ) {
      extraBaseUrls.push('github.com', 'gist.github.com');
    } else {
      getHostsFromRulesGithub.forEach(host => {
        extraBaseUrls.push(host, `gist.${host}`);
      });
    }
    url = parse(url, {
      extraBaseUrls,
    });
    if (url !== null || url !== undefined) {
      return url;
    }
  }
  if (parsedUrl.protocol && parsedUrl.host && parsedUrl.path) {
    let tmpProtocol: string;
    if (parsedUrl.protocol !== 'http:') {
      tmpProtocol = 'https:';
    } else {
      tmpProtocol = 'http:';
    }
    const getHostsFromRulesGitlab =
      hostRules.hosts({ hostType: 'gitlab' }) || [];
    const getHostsFromRulesBitbucket =
      hostRules.hosts({ hostType: 'bitbucket' }) || [];
    const getHostsFromRulesBitbucketServer =
      hostRules.hosts({ hostType: 'bitbucket-server' }) || [];
    const gitInfo = hostedGitInfo.fromUrl(url) || null;
    let tmpurl: string;
    if (gitInfo) {
      tmpurl = gitInfo.browse({ noGitPlus: true, noCommittish: true });
    }
    if (
      getHostsFromRulesGitlab.includes(parsedUrl.host) ||
      parsedUrl.host === 'gitlab.com'
    ) {
      if (gitInfo && gitInfo.type === 'gitlab') {
        url = tmpurl;
      } else {
        url = `${tmpProtocol}//${parsedUrl.host}${parsedUrl.path
          .replace(RegExp('/api/v[3|4]/'), '')
          .replace(':', '')
          .replace(RegExp('.git$'), '')
          .split('/')
          .join('/')
          .replace(RegExp('/$'), '')}`;
      }
    } else if (
      getHostsFromRulesBitbucket.includes(parsedUrl.host) ||
      parsedUrl.host === 'bitbucket.org' ||
      getHostsFromRulesBitbucketServer.includes(parsedUrl.host)
    ) {
      if (gitInfo && gitInfo.type === 'bitbucket') {
        url = tmpurl;
      } else {
        url = `${tmpProtocol}//${parsedUrl.host}${parsedUrl.path
          .replace(':', '')
          .split('/')
          .slice(0, 3)
          .join('/')
          .replace(RegExp('.git$'), '')
          .replace(RegExp('/$'), '')}`;
      }
    }
    return url.replace(RegExp('.git$'), '').replace(RegExp('/$'), '');
  }
  /* todo add azure support. */
  return null;
}
export async function fetchReleases(
  config: PkgReleaseConfig
): Promise<ReleaseResult | null> {
  const { datasource } = config;
  // istanbul ignore if
  if (!datasource) {
    logger.warn('No datasource found');
  }
  if (!datasources[datasource]) {
    logger.warn('Unknown datasource: ' + datasource);
    return null;
  }
  const dep = await datasources[datasource].getPkgReleases(config);
  addMetaData(dep, datasource, config.lookupName);
  if (dep && Object.entries(dep).length !== 0 && dep.sourceUrl !== undefined) {
    const tmpSourceUrl = baseUrlLegacyMassager(dep.sourceUrl);
    /* istanbul ignore if */
    if (tmpSourceUrl !== null) {
      dep.sourceUrl = tmpSourceUrl;
    } else {
      /* istanbul ignore next */
      dep.homepage = dep.sourceUrl;
      delete dep.sourceUrl;
    }
  }
  return dep;
}
function getRawReleases(config: PkgReleaseConfig): Promise<ReleaseResult> {
  const cacheKey =
    cacheNamespace +
    config.datasource +
    config.lookupName +
    config.registryUrls;
  // The repoCache is initialized for each repo
  // By returning a Promise and reusing it, we should only fetch each package at most once
  if (!global.repoCache[cacheKey]) {
    global.repoCache[cacheKey] = fetchReleases(config);
  }
  return global.repoCache[cacheKey];
}
export async function getPkgReleases(config: PkgReleaseConfig) {
  const res = await getRawReleases({
    ...config,
    lookupName: config.lookupName || config.depName,
  });
  if (!res) {
    return res;
  }
  const versionScheme =
    config && config.versionScheme ? config.versionScheme : 'semver';
  // Filter by version scheme
  const version = versioning.get(versionScheme);
  // Return a sorted list of valid Versions
  function sortReleases(release1: Release, release2: Release) {
    return version.sortVersions(release1.version, release2.version);
  }
  if (res.releases) {
    res.releases = res.releases
      .filter(release => version.isVersion(release.version))
      .sort(sortReleases);
  }
  return res;
}

export function supportsDigests(config: DigestConfig) {
  return !!datasources[config.datasource].getDigest;
}

export function getDigest(
  config: DigestConfig,
  value?: string
): Promise<string | null> {
  const lookupName = config.lookupName || config.depName;
  const { registryUrls } = config;
  return datasources[config.datasource].getDigest(
    { lookupName, registryUrls },
    value
  );
}
