import os from 'os';
import { promisify } from 'util';
import fs from 'fs-extra';
import g from 'glob';
import JSON5 from 'json5';
import shell from 'shelljs';
import Git from 'simple-git';
import path from 'upath';
import { updateJsonFile } from './utils.mjs';

const glob = promisify(g);
const localPath = path.join(os.tmpdir(), 'azure-pipelines-tasks');

/**
 * This script:
 *  1. Clones the Azure Pipelines Tasks repo
 *  2. Finds all `task.json` files
 *  3. For each `task.json` it finds each commit that has that file
 *  4. For each commit it gets the `task.json` content and extracts the task name and version
 *  5. After all the `task.json` files have been processed it writes the results to `./data/azure-pipelines-tasks.json`
 */
await (async () => {
  shell.echo('Generating azure pipelines tasks');
  await fs.ensureDir(localPath);
  const git = Git(localPath);

  if (await git.checkIsRepo()) {
    await git.pull();
  } else {
    await git.clone(
      'https://github.com/microsoft/azure-pipelines-tasks.git',
      '.'
    );
  }

  // Find all `task.json` files
  const files = (await glob(path.join(localPath, '**/task.json'))).map((file) =>
    file.replace(`${localPath}/`, '')
  );

  /** @type {Record<string, Set<string>>} */
  const tasks = {};

  for (const file of files) {
    // Find all commits that have the file
    const revs = (await git.raw(['rev-list', 'HEAD', '--', file])).split('\n');
    shell.echo(`Parsing ${file}`);
    for (const rev of revs) {
      try {
        // Get the content of the file at the commit
        const content = await git.show([`${rev}:${file}`]);
        /** @type {{name: string, version: {Major: number, Minor: number, Patch: number}}} */
        const parsedContent = JSON5.parse(content);
        const version = `${parsedContent.version.Major}.${parsedContent.version.Minor}.${parsedContent.version.Patch}`;
        tasks[parsedContent.name.toLowerCase()] =
          tasks[parsedContent.name.toLowerCase()]?.add(version) ??
          new Set([version]);
      } catch (e) {
        shell.echo(`Failed to parse ${file} at ${rev}`);
        shell.echo(e.toString());
      }
    }
  }

  const data = JSON.stringify(
    tasks,
    (_, value) => (value instanceof Set ? [...value] : value),
    2
  );

  await updateJsonFile(`./data/azure-pipelines-tasks.json`, data);
})();
