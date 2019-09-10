import { logger } from '../../logger';
import got from '../../util/got';
import { PkgReleaseConfig, ReleaseResult, Release } from '../common';

export async function getPkgReleases({
  lookupName,
}: PkgReleaseConfig): Promise<ReleaseResult> {
  const path = `/repos/ocaml/opam-repository/contents/packages/${lookupName}/`;
  const baseUrl = 'https://api.github.com';
  const packageUrl = baseUrl + path;
  let res: any = await got(packageUrl, {
    hostType: 'esy',
    json: true,
  });
  // TODO: Read homepage, name, and maybe other metadata from /packages/${lookupName}/${lookupName.1.2.3}/opam
  // where 1.2.3 can be any existing version, check if there is a mechanism for deprication
  const versions: string[] = res.body.map(file =>
    file.name.substring(file.name.indexOf('.') + 1)
  );
  /*
  const packageVersionBaseUrl =
    'https://raw.githubusercontent.com/ocaml/opam-repository/master/';
  const packageVersionPath = `packages/${lookupName}/${lookupName}.${versions[0]}/opam`
  const packageVersionUrl = packageVersionBaseUrl + packageVersionPath;
  res = await got(packageVersionUrl, {
    hostType: 'esy',
  });
  console.log(res.body);
  */
  const releases: Release[] = versions.map(version => ({ version }));
  const result: ReleaseResult = { name: lookupName, releases };
  return result;
}
