import is from '@sindresorhus/is';
import url from 'url';
import { HTMLElement, parse } from 'node-html-parser';
import { logger } from '../../logger';
import { matches } from '../../versioning/pep440';
import got from '../../util/got';
import { DigestConfig, PkgReleaseConfig, ReleaseResult } from '../common';

function normalizeName(input: string) {
  return input.toLowerCase().replace(/(-|\.)/g, '_');
}

function compatibleVersions(
  releases: Record<string, { requires_python?: boolean }[]>,
  compatibility: Record<string, string>
) {
  const versions = Object.keys(releases);
  if (!(compatibility && compatibility.python)) {
    return versions;
  }
  return versions.filter(version =>
    releases[version].some(release => {
      if (!release.requires_python) {
        return true;
      }
      return matches(compatibility.python, release.requires_python);
    })
  );
}

function getHostUrls(registryUrls?: string[]) {
  const result = new Set<string>();
  if (process.env.PIP_INDEX_URL) {
    result.add(process.env.PIP_INDEX_URL);
  } else if (is.nonEmptyArray(registryUrls)) {
    registryUrls.forEach(registryUrl => {
      result.add(registryUrl);
    });
  } else {
    result.add('https://pypi.org/pypi/');
  }
  return [...result].map(hostUrl => hostUrl.replace(/\/*$/, '/'));
}

function isSimple(hostUrl: string) {
  return /\/\+?simple\/$/.test(hostUrl);
}

export async function getPkgReleases({
  compatibility,
  lookupName,
  registryUrls,
}: PkgReleaseConfig): Promise<ReleaseResult | null> {
  for (const hostUrl of getHostUrls(registryUrls)) {
    let dep: ReleaseResult;
    if (isSimple(hostUrl)) {
      dep = await getSimpleDependency(lookupName, hostUrl);
    } else {
      dep = await getDependency(lookupName, hostUrl, compatibility);
    }
    if (dep !== null) {
      return dep;
    }
  }
  return null;
}

function getLookupUrl(depName: string, hostUrl: string, json: boolean) {
  const depUrl = json ? `${depName}/json` : depName;
  return url.resolve(hostUrl, depUrl);
}

async function requestDepData(depName: string, hostUrl: string, json: boolean) {
  const lookupUrl = getLookupUrl(depName, hostUrl, json);
  const opts = { json, hostType: 'pypi' };
  const resp = await got(url.parse(lookupUrl), opts);
  return resp && resp.body;
}

async function getDependency(
  depName: string,
  hostUrl: string,
  compatibility: Record<string, string>
): Promise<ReleaseResult | null> {
  try {
    const dependency: ReleaseResult = { releases: null };
    const dep = await requestDepData(depName, hostUrl, true);
    if (!dep) {
      logger.debug({ dependency: depName }, 'pip package not found');
      return null;
    }
    if (
      !(dep.info && normalizeName(dep.info.name) === normalizeName(depName))
    ) {
      logger.warn(
        {
          lookupUrl: getLookupUrl(depName, hostUrl, true),
          lookupName: depName,
          returnedName: dep.info.name,
        },
        'Returned name does not match with requested name'
      );
      return null;
    }
    if (dep.info && dep.info.home_page) {
      if (dep.info.home_page.match(/^https?:\/\/github.com/)) {
        dependency.sourceUrl = dep.info.home_page.replace(
          'http://',
          'https://'
        );
      } else {
        dependency.homepage = dep.info.home_page;
      }
    }
    dependency.releases = [];
    if (dep.releases) {
      const versions = compatibleVersions(dep.releases, compatibility);
      dependency.releases = versions.map(version => ({
        version,
        releaseTimestamp: (dep.releases[version][0] || {}).upload_time,
      }));
    }
    return dependency;
  } catch (err) {
    logger.info(
      'pypi dependency not found: ' + depName + '(searching in ' + hostUrl + ')'
    );
    return null;
  }
}

async function getSimpleDependency(
  depName: string,
  hostUrl: string
): Promise<ReleaseResult | null> {
  try {
    const dependency: ReleaseResult = { releases: null };
    const dep = await requestDepData(depName, hostUrl, false);
    if (!dep) {
      logger.debug({ dependency: depName }, 'pip package not found');
      return null;
    }
    const root: HTMLElement = parse(dep) as any;
    const links = root.querySelectorAll('a');
    const versions = new Set<string>();
    for (const link of Array.from(links)) {
      const result = extractVersionFromLinkText(link.text, depName);
      if (result) {
        versions.add(result);
      }
    }
    dependency.releases = [];
    if (versions && versions.size > 0) {
      dependency.releases = [...versions].map(version => ({
        version,
      }));
    }
    return dependency;
  } catch (err) {
    logger.info(
      'pypi dependency not found: ' + depName + '(searching in ' + hostUrl + ')'
    );
    return null;
  }
}

function extractVersionFromLinkText(
  text: string,
  depName: string
): string | null {
  const prefix = `${depName}-`;
  const suffix = '.tar.gz';
  if (!(text.startsWith(prefix) && text.endsWith(suffix))) {
    return null;
  }
  return text.replace(prefix, '').replace(/\.tar\.gz$/, '');
}

function getPackageKey({ packagetype, python_version }) {
  if (packagetype && python_version) {
    return `${packagetype}:${python_version}`;
  }
  return null;
}

function packageKeyForDigest(releases, currentDigest) {
  const [alg, digest] = currentDigest.split(':');
  let result = null;
  if (releases) {
    Object.keys(releases).forEach(v => {
      const items = releases[v] || [];
      items.forEach(release => {
        const { digests } = release;
        if (digests && digests[alg] === digest) {
          result = getPackageKey(release);
        }
      });
    });
  }
  return result;
}

export async function getDigest(
  config: Partial<DigestConfig>,
  value?: string
): Promise<string | null> {
  const { lookupName, registryUrls } = config;
  for (const hostUrl of getHostUrls(registryUrls)) {
    let data;
    let result = null;
    if (isSimple(hostUrl)) {
      // data = await requestDepData(lookupName, hostUrl, false);
      // TODO: handle this branch
    } else {
      data = await requestDepData(lookupName, hostUrl, true);
      if (data) {
        const currentDigest = config.currentDigest;
        const [alg] = currentDigest.split(':');
        const packageKey = packageKeyForDigest(data.releases, currentDigest);
        if (packageKey) {
          const newReleases = data.releases[value.replace(/^==/, '')];
          newReleases.forEach(newRelease => {
            const key = getPackageKey(newRelease);
            if (key === packageKey && newRelease.digests) {
              result = `${alg}:${newRelease.digests[alg]}`;
            }
          });
        }
      }
    }
    return result;
  }
  return null;
}
