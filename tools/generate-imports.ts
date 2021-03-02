import fs from 'fs-extra';
import shell from 'shelljs';

shell.echo('generating imports');
const newFiles = new Set();

if (!fs.existsSync('lib')) {
  shell.echo('> missing sources');
  shell.exit(0);
}

if (!fs.existsSync('data')) {
  shell.echo('> missing data folder');
  shell.exit(0);
}

async function updateFile(file: string, code: string): Promise<void> {
  const oldCode = fs.existsSync(file) ? await fs.readFile(file, 'utf8') : null;
  if (code !== oldCode) {
    await fs.writeFile(file, code);
  }
  newFiles.add(file);
}

async function generateData(): Promise<void> {
  const files = fs
    .readdirSync('data', { withFileTypes: true })
    .filter((dirent) => dirent.isFile())
    .map((dirent) => dirent.name)
    .sort();

  const importDataFileType = files.map((x) => `  | '${x}'`).join('\n');

  const contentMapDecl = 'const data = new Map<DataFile, string>();';

  const contentMapAssignments: string[] = [];
  for (const file of files) {
    shell.echo(`> data/${file}`);
    const rawFileContent = await fs.readFile(`data/${file}`, 'utf8');
    contentMapAssignments.push(
      `data.set('${file}', ${JSON.stringify(rawFileContent)});`
    );
  }

  await updateFile(
    `lib/data-files.generated.ts`,
    [
      `type DataFile =\n${importDataFileType};`,
      contentMapDecl,
      contentMapAssignments.join('\n'),
      `export default data;\n`,
    ].join('\n\n')
  );
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  try {
    // data-files
    await generateData();
    await Promise.all(
      shell
        .find('lib/**/*.generated.ts')
        .filter((f) => !newFiles.has(f))
        .map((file) => fs.remove(file))
    );
  } catch (e) {
    shell.echo(e.toString());
    shell.exit(1);
  }
})();
