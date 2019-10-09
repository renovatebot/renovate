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

function extractHomepage(opamContentWithComments) {
  let opamContent = opamContentWithComments;
  opamContent = removeLineComments(opamContent);
  opamContent = removeMultiLineComments(opamContent);
  const homepageIndex = opamContent.indexOf('homepage');
  if (homepageIndex < 0) {
    return null;
  }
  let homepage = opamContent.substring(homepageIndex);
  homepage = homepage.substring('homepage'.length);
  const colonIndex = skip(0, homepage, isSpace);
  if (homepage[colonIndex] !== ':') {
    return null;
  }
  homepage = homepage.substring(colonIndex + 1);
  // According to opam docs https://opam.ocaml.org/doc/1.2/Manual.html
  // strings are enclosed in "double quotes"
  const doubleQuoteIndex = skip(0, homepage, isSpace);
  if (homepage[doubleQuoteIndex] !== '"') {
    return null;
  }
  homepage = homepage.substring(doubleQuoteIndex + 1);
  const secondDoubleQuoteIndex = homepage.indexOf('"');
  if (secondDoubleQuoteIndex < 0) {
    return null;
  }
  homepage = homepage.substring(0, secondDoubleQuoteIndex);
  return homepage;
}

function skip(
  idx: number,
  content: string,
  cond: (s: string) => boolean
): number {
  let i = idx;
  while (i < content.length) {
    if (!cond(content[i])) {
      return i;
    }
    i += 1;
  }
  // istanbul ignore next
  return i;
}

function isSpace(c: string): boolean {
  return /\s/.test(c);
}

// Remove multi-line comments enclosed between (* and *)
function removeMultiLineComments(content: string): string {
  const beginRegExp = /\(\*/;
  const endRegExp = /\*\)/;
  let newContent = content;
  let i = newContent.search(beginRegExp);
  let j = newContent.search(endRegExp);
  while (i !== -1 && j !== -1) {
    j += '*)'.length;
    newContent = newContent.substring(0, i) + newContent.substring(j);
    i = newContent.search(beginRegExp);
    j = newContent.search(endRegExp);
  }
  return newContent;
}

// Remove line comments starting with #
function removeLineComments(content: string): string {
  let newContent = '';
  let comment = false;
  for (let i = 0; i < content.length; i += 1) {
    const c = content[i];
    if (c === '#') {
      comment = true;
    }
    if (comment) {
      if (c === '\n') {
        comment = false;
      }
    }
    if (!comment) {
      newContent += c;
    }
  }
  return newContent;
}
