import { adoptiumRegistryUrl } from '../../../lib/modules/datasource/java-version/adoptium.ts';
import { AdoptiumAvailableReleases } from '../../../lib/modules/datasource/java-version/schema.ts';
import { Json } from '../../../lib/util/schema-utils/index.ts';
import type { StaticDataSource } from '../types.ts';
import { fetchText } from '../utils.ts';

export const javaLtsVersions: StaticDataSource<
  AdoptiumAvailableReleases,
  number[]
> = {
  name: 'java-lts-versions',
  file: 'lib/data/java-version-lts.json',
  fetch: async () =>
    Json.pipe(AdoptiumAvailableReleases).parse(
      await fetchText(`${adoptiumRegistryUrl}v3/info/available_releases`),
    ),
  generate: ({ available_lts_releases }) =>
    [...available_lts_releases].sort((a, b) => a - b),
};
