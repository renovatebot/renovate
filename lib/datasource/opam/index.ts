import { logger } from '../../logger';
import got from '../../util/got';
import { PkgReleaseConfig, ReleaseResult, Release } from '../common';
import { parseDepName } from '../../manager/esy/extract';

export async function getPkgReleases({
  lookupName,
}: PkgReleaseConfig): Promise<ReleaseResult> {
  const { depName } = parseDepName(lookupName);
  const path = `/repos/ocaml/opam-repository/contents/packages/${depName}/`;
  const baseUrl = 'https://api.github.com';
  const packageUrl = baseUrl + path;
  let res: any = await got(packageUrl, {
    hostType: 'esy',
    json: true,
  });
  // TODO: Read homepage, name, and maybe other metadata from /packages/${depName}/${lookupName.1.2.3}/opam
  // where 1.2.3 can be any existing version, check if there is a mechanism for deprication
  const versions: string[] = res.body.map(file =>
    file.name.substring(file.name.indexOf('.') + 1)
  );
  const packageVersionUrl = baseUrl + path + `${depName}.${versions[0]}/opam`;
  res = await got(packageVersionUrl, {
    hostType: 'esy',
    json: true,
  });
  const opamContent = Buffer.from(res.body.content, 'base64').toString('utf8');
  // const opamContent = atob(res.body.content);
  const homepage = extractHomepage(opamContent);
  const releases: Release[] = versions.map(version => ({ version }));
  const result: ReleaseResult = { name: depName, homepage, releases };
  return result;
}

// TODO Add error checking
function extractHomepage(opamContent) {
  const homepageIndex = opamContent.indexOf('homepage');
  let homepage = opamContent.substring(homepageIndex);
  const firstQuoteIndex = homepage.indexOf('"');
  homepage = homepage.substring(firstQuoteIndex + 1);
  const secondQuoteIndex = homepage.indexOf('"');
  homepage = homepage.substring(0, secondQuoteIndex);
  return homepage;
}
