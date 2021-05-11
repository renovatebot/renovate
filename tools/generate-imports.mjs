import fs from 'fs-extra';
import shell from 'shelljs';
import upath from 'upath';

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

/**
 *
 * @param {string} file
 * @param {string} code
 */
async function updateFile(file, code) {
  const oldCode = fs.existsSync(file) ? await fs.readFile(file, 'utf8') : null;
  if (code !== oldCode) {
    await fs.writeFile(file, code);
  }
  newFiles.add(file);
}

const dataPaths = [
  'data',
  'node_modules/emojibase-data/en/shortcodes/github.json',
];

/**
 *
 * @param {string[]} paths
 * @returns {string[]}
 */
function expandPaths(paths) {
  return paths
    .map((pathName) => {
      const stat = fs.statSync(pathName);

      if (stat.isFile()) {
        return [pathName];
      }

      if (stat.isDirectory()) {
        const dirPaths = fs
          .readdirSync(pathName, { withFileTypes: true })
          .filter(
            (dirent) =>
              !(dirent.isFile() && ['.DS_Store'].includes(dirent.name))
          )
          .map((dirent) => upath.join(pathName, dirent.name));
        return expandPaths(dirPaths);
      }

      return [];
    })
    .reduce((x, y) => x.concat(y));
}

async function generateData() {
  const files = expandPaths(dataPaths).sort();

  const importDataFileType = files.map((x) => `  | '${x}'`).join('\n');

  const contentMapDecl = 'const data = new Map<DataFile, string>();';

  /** @type {string[]} */
  const contentMapAssignments = [];
  for (const file of files) {
    const key = file.replace(/\\/g, '/');

    const rawFileContent = await fs.readFile(file, 'utf8');
    const value = JSON.stringify(rawFileContent);

    shell.echo(`> ${key}`);
    contentMapAssignments.push(`data.set('${key}', ${value});`);
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
