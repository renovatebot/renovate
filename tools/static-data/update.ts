import { Argument, Command } from 'commander';
import fs from 'fs-extra';
import prettier from 'prettier';
import { quickStringify } from '../../lib/util/stringify.ts';
import { distroInfo } from './sources/distro-info.ts';
import { javaLtsVersions } from './sources/java-lts-versions.ts';
import { lambdaNodeSchedule } from './sources/lambda-node-schedule.ts';
import { miseRegistry } from './sources/mise-registry.ts';
import { nodeSchedule } from './sources/node-schedule.ts';
import type { StaticDataSource } from './types.ts';

const sources: StaticDataSource<unknown, object>[] = [
  distroInfo('ubuntu'),
  distroInfo('debian'),
  javaLtsVersions,
  lambdaNodeSchedule,
  miseRegistry,
  nodeSchedule,
];

await new Command('pnpm update-static-data')
  .description('Update the static data used by Renovate')
  .addArgument(
    new Argument(
      '[sources...]',
      'the static data sources to update (default: all)',
    ).choices(sources.map((s) => s.name)),
  )
  .action(async (names: string[]) => {
    for (const source of sources) {
      if (names.length > 0 && !names.includes(source.name)) {
        continue;
      }

      console.log(`Updating ${source.name} (${source.file})`);
      const data = source.generate(await source.fetch());
      const contents = await prettier.format(quickStringify(data, null, 2), {
        parser: 'json',
      });
      await fs.writeFile(source.file, contents);
    }
  })
  .parseAsync();
