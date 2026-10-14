import { adoptiumRegistryUrl } from '../../lib/modules/datasource/java-version/adoptium.ts';
import { AdoptiumAvailableReleases } from '../../lib/modules/datasource/java-version/schema.ts';
import { Json } from '../../lib/util/schema-utils/index.ts';
import { updateJsonFile } from './utils.mjs';

const availableReleasesUrl = `${adoptiumRegistryUrl}v3/info/available_releases`;

console.log('Generating Java LTS versions');
const res = await fetch(availableReleasesUrl);
if (!res.ok) {
  console.error(`Failed to fetch ${availableReleasesUrl}`, res);
  process.exit(1);
}

const { available_lts_releases: ltsVersions } = Json.pipe(
  AdoptiumAvailableReleases,
).parse(await res.text());

await updateJsonFile(
  'lib/data/java-version-lts.json',
  JSON.stringify(
    [...ltsVersions].sort((a, b) => a - b),
    null,
    2,
  ),
);
