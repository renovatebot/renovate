import is from '@sindresorhus/is';
import url from 'url';
import { parse } from 'node-html-parser';
import { logger } from '../../logger';
import { matches } from '../../versioning/pep440';
import got from '../../util/got';
import { PkgReleaseConfig, ReleaseResult } from '../common';

function normalizeName(input: string): string {
  return input.toLowerCase().replace(/(-|\.)/g, '_');
}

function compatibleVersions(
  releases: Record<string, { requires_python?: boolean }[]>,
  compatibility: Record<string, string>
): string[] {
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

async function getDependency(
  depName: string,
  hostUrl: string,
  compatibility: Record<string, string>
): Promise<ReleaseResult | null> {
  const lookupUrl = url.resolve(hostUrl, `${depName}/json`);
  try {
    const dependency: ReleaseResult = { releases: null };
    const rep = await got(url.parse(lookupUrl), {
      json: true,
      hostType: 'pypi',
    });
    const dep = rep && rep.body;
    if (!dep) {
      logger.debug({ dependency: depName }, 'pip package not found');
      return null;
    }
    if (
      !(dep.info && normalizeName(dep.info.name) === normalizeName(depName))
    ) {
      logger.warn(
        { lookupUrl, lookupName: depName, returnedName: dep.info.name },
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

function extractVersionFromLinkText(
  text: string,
  depName: string
): string | null {
  const prefix = `${depName}-`;
  const suffix = '.tar.gz';
  if (text.startsWith(prefix) && text.endsWith(suffix)) {
    return text.replace(prefix, '').replace(/\.tar\.gz$/, '');
  }

  // pep-0427 wheel packages
  //  {distribution}-{version}(-{build tag})?-{python tag}-{abi tag}-{platform tag}.whl.
  const wheelPrefix = depName.replace(/[^\w\d.]+/g, '_') + '-';
  const wheelSuffix = '.whl';
  if (
    text.startsWith(wheelPrefix) &&
    text.endsWith(wheelSuffix) &&
    text.split('-').length > 2
  ) {
    return text.split('-')[1];
  }

  return null;
}

async function getSimpleDependency(
  depName: string,
  hostUrl: string
): Promise<ReleaseResult | null> {
  const lookupUrl = url.resolve(hostUrl, `${depName}`);
  try {
    const dependency: ReleaseResult = { releases: null };
    const response = await got<string>(url.parse(lookupUrl), {
      hostType: 'pypi',
    });
    const dep = response && response.body;
    if (!dep) {
      logger.debug({ dependency: depName }, 'pip package not found');
      return null;
    }
    const root: HTMLElement = parse(dep.replace(/<\/?pre>/, '')) as any;
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

export async function getPkgReleases({
  compatibility,
  lookupName,
  registryUrls,
}: PkgReleaseConfig): Promise<ReleaseResult | null> {
  let hostUrls = ['https://pypi.org/pypi/'];
  if (is.nonEmptyArray(registryUrls)) {
    hostUrls = registryUrls;
  }
  if (process.env.PIP_INDEX_URL) {
    hostUrls = [process.env.PIP_INDEX_URL];
  }
  for (let hostUrl of hostUrls) {
    hostUrl += hostUrl.endsWith('/') ? '' : '/';
    let dep: ReleaseResult;
    if (hostUrl.endsWith('/simple/') || hostUrl.endsWith('/+simple/')) {
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
