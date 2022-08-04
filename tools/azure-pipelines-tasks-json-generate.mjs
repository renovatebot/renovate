import os from 'os';
import { promisify } from 'util';
import fs from 'fs-extra';
import g from 'glob';
import JSON5 from 'json5';
import shell from 'shelljs';
import Git from 'simple-git';
import path from 'upath';

const glob = promisify(g);

const localPath = path.join(os.tmpdir(), 'azure-pipelines-tasks');

await (async () => {
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

  const files = (await glob(path.join(localPath, '**/task.json'))).map((file) =>
    file.replace(`${localPath}/`, '')
  );

  /** @type {Record<string, Set<string>>} */
  const tasks = {};

  for (const file of files) {
    const revs = (await git.raw(['rev-list', 'HEAD', '--', file])).split('\n');
    shell.echo(`Parsing ${file}`);
    for (const rev of revs) {
      try {
        const content = await git.show([`${rev}:${file}`]);
        /** @type {{name: string, version: {Major: number, Minor: number, Patch: number}}} */
        const parsedContent = JSON5.parse(content);
        const version = `${parsedContent.version.Major}.${parsedContent.version.Minor}.${parsedContent.version.Patch}`;
        tasks[parsedContent.name] =
          tasks[parsedContent.name]?.add(version) ?? new Set([version]);
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

  await fs.writeFile(`./data/azure-pipelines-tasks-info.json`, data);
})();
