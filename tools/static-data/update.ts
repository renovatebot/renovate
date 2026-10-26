import { Argument, Command } from 'commander';
import fs from 'fs-extra';
import prettier from 'prettier';
import { quickStringify } from '../../lib/util/stringify.ts';
import { exec } from '../utils/exec.ts';
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

interface Options {
  commit: boolean;
}

await new Command('pnpm update-static-data')
  .description('Update the static data used by Renovate')
  .addArgument(
    new Argument(
      '[sources...]',
      'the static data sources to update (default: all)',
    ).choices(sources.map((s) => s.name)),
  )
  .option(
    '--commit',
    'commit the changes to each source separately, with a descriptive message',
    false,
  )
  .action(async (names: string[], { commit }: Options) => {
    // the branches for each committed source, from the bottom of the stack to the top
    const branches: string[] = [];
    for (const source of sources) {
      if (names.length > 0 && !names.includes(source.name)) {
        continue;
      }

      console.log(`Updating ${source.name} (${source.file})`);
      const before = (await fs.pathExists(source.file))
        ? await fs.readJson(source.file)
        : undefined;
      const data = source.generate(await source.fetch());
      const contents = await prettier.format(quickStringify(data, null, 2), {
        parser: 'json',
      });
      await fs.writeFile(source.file, contents);

      if (!commit) {
        continue;
      }

      await exec('git', ['add', source.file]);
      const { exitCode } = await exec('git', ['diff', '--cached', '--quiet'], {
        reject: false,
      });
      if (exitCode === 0) {
        console.log(`No changes to ${source.name}`);
        continue;
      }

      const { subject, body } = source.commitMessage(before, data);
      const message = `feat(static-data): ${subject}`;
      await exec('git', ['commit', '--file', '-'], {
        input: body ? `${message}\n\n${body}` : message,
      });

      const branch = `chore/static-data/${source.name}`;
      await exec('git', ['branch', '--force', branch]);
      branches.push(branch);
      console.log(
        `Committed changes to ${source.name} on ${branch}: ${subject}`,
      );
    }

    if (process.env.GITHUB_OUTPUT) {
      await fs.appendFile(
        process.env.GITHUB_OUTPUT,
        `branches=${branches.join(' ')}\n`,
      );
    }
  })
  .parseAsync();
