import fs from 'fs-extra';
import hasha from 'hasha';
import minimatch from 'minimatch';
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
const options = {
  algorithm: 'sha256',
};

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
/**
 * @param {string} manager
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function getFileHash(manager, filePath) {
  try {
    const hash = await hasha.fromFile(
      `lib/modules/manager/${manager}/${filePath}`,
      options
    );
    return hash;
  } catch (err) {
    throw new Error(
      `ERROR: Unable to generate hash for manager/${manager}/${filePath}`
    );
  }
}
/**
 *
 * @param {string} managerName
 * @returns {Promise<string>}
 */
export async function getManagerHash(managerName) {
  try {
    let hashes = [];
    let files = await fs.readdir(`lib/modules/manager/${managerName}`);

    if (files.includes('__snapshots__')) {
      const snapshots = await fs.readdir(
        `lib/modules/manager/${managerName}/__snapshots__`
      );

      for (const snap of snapshots) {
        const hash = getFileHash(managerName, `__snapshots__/${snap}`);
        hashes.push(hash);
      }
    }

    files = files.filter((fileName) => minimatch(fileName, '*.spec.ts'));
    for (const file of files) {
      const hash = getFileHash(managerName, file);
      hashes.push(hash);
    }

    hashes = await Promise.all(hashes);

    if (hashes.length) {
      return hasha(hashes, options);
    }

    throw new Error(`Unable to generate hash for manager/${managerName}`);
  } catch (err) {
    throw new Error(err.message);
  }
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

async function generateHash() {
  shell.echo('generating hashes');
  try {
    const hashMap = `export const hashMap = new Map<string, string>();`;
    let hashes = [];
    // get managers list
    const managers = (
      await fs.readdir('lib/modules/manager', { withFileTypes: true })
    )
      .filter((file) => file.isDirectory())
      .map((file) => file.name);

    for (const manager of managers) {
      const hash = await getManagerHash(manager);
      hashes.push(hash);
    }

    //add manager hashes to hashMap {key->manager, value->hash}
    hashes = (await Promise.all(hashes)).map(
      (hash, index) => `hashMap.set(\n  '${managers[index]}',\n  '${hash}'\n);`
    );

    //write hashMap to fingerprint.generated.ts
    await updateFile(
      'lib/modules/manager/fingerprint.generated.ts',
      [hashMap, hashes.join('\n')].join('\n\n') + '\n'
    );
  } catch (err) {
    shell.echo('ERROR:', err.message);
    process.exit(1);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  try {
    // data-files
    await generateData();
    await generateHash();
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
