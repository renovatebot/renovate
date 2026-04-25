import { execSync } from 'child_process';
import { z } from 'zod/v4';
import { MiseRegistryJson } from '../../lib/modules/manager/mise/schema.ts';
import { updateJsonFile } from './utils.mjs';

const MiseVersion = z.object({ version: z.string() });
const MiseRegistry = z.array(
  z.object({ short: z.string(), backends: z.array(z.string()) }),
);

// use the JSON output, as the default output includes a banner
const versionOutput = execSync('mise version --json', { encoding: 'utf8' });
const version = MiseVersion.parse(JSON.parse(versionOutput));
console.log(`Generating mise registry using mise version ${version.version}`);
const output = execSync('mise registry --json', { encoding: 'utf8' });
const tools = MiseRegistry.parse(JSON.parse(output));

const registry = MiseRegistryJson.parse(
  Object.fromEntries(
    tools
      .map(({ short, backends }): [string, string[]] => [short, backends])
      .sort(([a], [b]) => a.localeCompare(b)),
  ),
);

await updateJsonFile(
  'lib/data/mise-registry.json',
  JSON.stringify(registry, null, 2) + '\n',
);
