import is from '@sindresorhus/is';
import url from 'url';
import { parse } from 'node-html-parser';
import { logger } from '../../logger';
import { matches } from '../../versioning/pep440';
import got from '../../util/got';
import { GetReleasesConfig, ReleaseResult } from '../common';

export const id = 'pypi';

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
  packageName: string,
  hostUrl: string,
  compatibility: Record<string, string>
): Promise<ReleaseResult | null> {
  try {
    const lookupUrl = url.resolve(hostUrl, `${packageName}/json`);
    const dependency: ReleaseResult = { releases: null };
    logger.trace({ lookupUrl }, 'Pypi api got lookup');
    const rep = await got(url.parse(lookupUrl), {
      json: true,
      hostType: id,
    });
    const dep = rep && rep.body;
    if (!dep) {
      logger.trace({ dependency: packageName }, 'pip package not found');
      return null;
    }
    logger.trace({ lookupUrl }, 'Got pypi api result');
    if (
      !(dep.info && normalizeName(dep.info.name) === normalizeName(packageName))
    ) {
      logger.warn(
        { lookupUrl, lookupName: packageName, returnedName: dep.info.name },
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
    logger.debug(
      'pypi dependency not found: ' +
        packageName +
        '(searching in ' +
        hostUrl +
        ')'
    );
    return null;
  }
}

function extractVersionFromLinkText(
  text: string,
  packageName: string
): string | null {
  const srcPrefixes = [`${packageName}-`, `${packageName.replace(/-/g, '_')}-`];
  for (const prefix of srcPrefixes) {
    const suffix = '.tar.gz';
    if (text.startsWith(prefix) && text.endsWith(suffix)) {
      return text.replace(prefix, '').replace(/\.tar\.gz$/, '');
    }
  }

  // pep-0427 wheel packages
  //  {distribution}-{version}(-{build tag})?-{python tag}-{abi tag}-{platform tag}.whl.
  const wheelPrefix = packageName.replace(/[^\w\d.]+/g, '_') + '-';
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
  packageName: string,
  hostUrl: string
): Promise<ReleaseResult | null> {
  const lookupUrl = url.resolve(hostUrl, `${packageName}`);
  try {
    const dependency: ReleaseResult = { releases: null };
    const response = await got<string>(url.parse(lookupUrl), {
      hostType: id,
    });
    const dep = response && response.body;
    if (!dep) {
      logger.trace({ dependency: packageName }, 'pip package not found');
      return null;
    }
    const root: HTMLElement = parse(dep.replace(/<\/?pre>/, '')) as any;
    const links = root.querySelectorAll('a');
    const versions = new Set<string>();
    for (const link of Array.from(links)) {
      const result = extractVersionFromLinkText(link.text, packageName);
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
    logger.debug(
      'pypi dependency not found: ' +
        packageName +
        '(searching in ' +
        hostUrl +
        ')'
    );
    return null;
  }
}

export async function getPkgReleases({
  compatibility,
  lookupName,
  registryUrls,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  let hostUrls = ['https://pypi.org/pypi/'];
  if (is.nonEmptyArray(registryUrls)) {
    hostUrls = registryUrls;
  }
  if (process.env.PIP_INDEX_URL) {
    hostUrls = [process.env.PIP_INDEX_URL];
  }
  let dep: ReleaseResult;
  for (let index = 0; index < hostUrls.length && !dep; index += 1) {
    let hostUrl = hostUrls[index];
    hostUrl += hostUrl.endsWith('/') ? '' : '/';
    if (hostUrl.endsWith('/simple/') || hostUrl.endsWith('/+simple/')) {
      logger.trace(
        { lookupName, hostUrl },
        'Looking up pypi simple dependency'
      );
      dep = await getSimpleDependency(lookupName, hostUrl);
    } else {
      logger.trace({ lookupName, hostUrl }, 'Looking up pypi api dependency');
      dep = await getDependency(lookupName, hostUrl, compatibility);
    }
    if (dep !== null) {
      logger.trace({ lookupName, hostUrl }, 'Found pypi result');
    }
  }
  if (dep) {
    return dep;
  }
  logger.debug({ lookupName, registryUrls }, 'No pypi result - returning null');
  return null;
}
