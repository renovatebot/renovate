import { parse } from 'toml';
import * as globalCache from '../../util/cache/global';
import { Http } from '../../util/http';
import { DatasourceError, GetReleasesConfig, ReleaseResult } from '../common';

export const id = 'julia-general';

const http = new Http(id);

export async function getReleases({
  lookupName,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const cacheNamespace = `datasource-${id}`;
  const cacheKey = lookupName;
  const cachedResult = await globalCache.get<ReleaseResult>(
    cacheNamespace,
    cacheKey
  );
  // istanbul ignore if
  if (cachedResult !== undefined) {
    return cachedResult;
  }

  const url = `https://raw.githubusercontent.com/JuliaRegistries/General/master/${lookupName[0].toUpperCase()}/${lookupName}/Versions.toml`;
  try {
    const projectToml = parse((await http.get(url)).body);
    const result: ReleaseResult = {
      releases: Object.keys(projectToml).map((version: string) => ({
        version,
        newDigest: projectToml[version]['git-tree-sha1'],
      })),
    };
    const cacheMinutes = 60;
    await globalCache.set(cacheNamespace, cacheKey, result, cacheMinutes);
    return result;
  } catch (err) {
    if (
      err.statusCode === 429 ||
      (err.statusCode >= 500 && err.statusCode < 600)
    ) {
      throw new DatasourceError(err);
    }
    return null;
  }
}
