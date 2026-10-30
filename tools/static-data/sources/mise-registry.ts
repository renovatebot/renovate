import { z } from 'zod/v4';
import { MiseRegistryJson } from '../../../lib/modules/manager/mise/schema.ts';
import { Json } from '../../../lib/util/schema-utils/index.ts';
import { exec } from '../../utils/exec.ts';
import type { StaticDataSource } from '../types.ts';
import { describeKeys } from '../utils.ts';

const MiseVersion = z.object({ version: z.string() });
const MiseRegistry = z.array(
  z.object({ short: z.string(), backends: z.array(z.string()) }),
);

interface MiseRaw {
  version: string;
  tools: z.infer<typeof MiseRegistry>;
}

export const miseRegistry: StaticDataSource<
  MiseRaw,
  z.infer<typeof MiseRegistryJson>
> = {
  name: 'mise-registry',
  file: 'lib/data/mise-registry.json',
  fetch: async () => {
    // use the JSON output, as the default output includes a banner
    const versionOutput = await exec('mise', ['version', '--json']);
    const { version } = Json.pipe(MiseVersion).parse(versionOutput.stdout);
    console.log(`Using mise version ${version}`);
    const output = await exec('mise', ['registry', '--json']);
    return { version, tools: Json.pipe(MiseRegistry).parse(output.stdout) };
  },
  generate: ({ version, tools }) =>
    MiseRegistryJson.parse({
      meta: {
        version,
      },
      tools: Object.fromEntries(
        tools
          .map(({ short, backends }): [string, Record<string, string>] => {
            const result: Record<string, string> = {};
            for (const backend of [...backends].sort()) {
              const [type, url] = backend.split(':');
              result[type] = url;
            }

            return [short, result];
          })
          .sort(([a], [b]) => a.localeCompare(b)),
      ),
    }),
  commitMessage: (before, after) =>
    describeKeys(before?.tools ?? {}, after.tools, (added) =>
      added.length > 0
        ? `add ${added.length} new mise tool${added.length === 1 ? '' : 's'}`
        : 'update mise registry',
    ),
};
