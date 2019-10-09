import { logger } from '../../logger';
import got from '../../util/got';
import { PkgReleaseConfig, ReleaseResult, Release } from '../common';
import { parseDepName } from '../../manager/esy/extract';

export async function getPkgReleases({
  lookupName,
}: PkgReleaseConfig): Promise<ReleaseResult> {
  const { depName } = parseDepName(lookupName);
  const cacheNamespace = 'datasource-opam';
  const cacheKey = lookupName;
  const cachedResult = await renovateCache.get<ReleaseResult>(
    cacheNamespace,
    cacheKey
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  const path = `/repos/ocaml/opam-repository/contents/packages/${depName}/`;
  const baseUrl = 'https://api.github.com';
  const packageUrl = baseUrl + path;
  let res: any;
  try {
    res = await got(packageUrl, {
      hostType: 'esy',
      json: true,
    });
  } catch (err) {
    if (
      err.statusCode === 429 ||
      (err.statusCode >= 500 && err.statusCode < 600)
    ) {
      logger.warn(
        { lookupName, err },
        `opam repository github.com registry failure`
      );
      throw new Error('registry-failure');
    }
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.warn({ lookupName }, `Dependency lookup failure: not found`);
      logger.debug({ err }, 'opam lookup error');
      return null;
    }
    return null;
  }
  const versions: string[] = res.body.map(file =>
    file.name.substring(file.name.indexOf('.') + 1)
  );
  let homepage: string;
  try {
    const packageVersionUrl = baseUrl + path + `${depName}.${versions[0]}/opam`;
    res = await got(packageVersionUrl, {
      hostType: 'esy',
      json: true,
    });
    const opamContent = Buffer.from(res.body.content, 'base64').toString(
      'utf8'
    );
    homepage = extractHomepage(opamContent);
  } catch (err) {}
  const releases: Release[] = versions.map(version => ({ version }));
  const result: ReleaseResult = { name: depName, releases };
  if (homepage) {
    result.homepage = homepage;
  }
  const cacheMinutes = 10;
  await renovateCache.set(cacheNamespace, cacheKey, result, cacheMinutes);
  return result;
}

function extractHomepage(opamContent) {
  const homepageIndex = opamContent.indexOf('homepage');
  if (homepageIndex < 0) {
    return null;
  }
  let homepage = opamContent.substring(homepageIndex);
  const firstQuoteIndex = homepage.indexOf('"');
  if (firstQuoteIndex < 0) {
    return null;
  }
  homepage = homepage.substring(firstQuoteIndex + 1);
  const secondQuoteIndex = homepage.indexOf('"');
  if (secondQuoteIndex < 0) {
    return null;
  }
  homepage = homepage.substring(0, secondQuoteIndex);
  return homepage;
}
