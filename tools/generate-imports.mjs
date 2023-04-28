import fs from 'fs-extra';
import { glob } from 'glob';
import hasha from 'hasha';
import minimatch from 'minimatch';
import upath from 'upath';

console.log('generating imports');
const newFiles = new Set();

if (!fs.existsSync('lib')) {
  console.log('> missing sources');
  process.exit(0);
}

if (!fs.existsSync('data')) {
  console.log('> missing data folder');
  process.exit(0);
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
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function getFileHash(filePath) {
  try {
    const hash = await hasha.fromFile(filePath, options);
    return hash;
  } catch (err) {
    throw new Error(`ERROR: Unable to generate hash for ${filePath}`);
  }
}

/**
 *
 * @param {string} managerName
 * @returns {Promise<string>}
 */
export async function getManagerHash(managerName) {
  /** @type {string[]} */
  let hashes = [];
  const files = (await glob(`lib/modules/manager/${managerName}/**`)).filter(
    (fileName) => minimatch(fileName, '*.+(snap|spec.ts)', { matchBase: true })
  );

  for (const fileAddr of files) {
    const hash = await getFileHash(fileAddr);
    hashes.push(hash);
  }

  if (hashes.length) {
    return hasha(hashes, options);
  }

  throw new Error(`Unable to generate hash for manager/${managerName}`);
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

    console.log(`> ${key}`);
    contentMapAssignments.push(`data.set('${key}', ${value});`);
  }

  await updateFile(
    `lib/data-files.generated.ts`,
    [
      `export type DataFile =\n${importDataFileType};`,
      contentMapDecl,
      contentMapAssignments.join('\n'),
      `export default data;\n`,
    ].join('\n\n')
  );
}

async function generateHash() {
  console.log('generating hashes');
  try {
    const hashMap = `export const hashMap = new Map<string, string>();`;
    /** @type {string[]} */
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
      (hash, index) => `hashMap.set('${managers[index]}','${hash}');`
    );

    //write hashMap to fingerprint.generated.ts
    await updateFile(
      'lib/modules/manager/fingerprint.generated.ts',
      [hashMap, hashes.join('\n')].join('\n\n')
    );
  } catch (err) {
    console.log('ERROR:', err.message);
    process.exit(1);
  }
}

await (async () => {
  try {
    // data-files
    await generateData();
    await generateHash();
    await Promise.all(
      (await glob('lib/**/*.generated.ts'))
        .filter((f) => !newFiles.has(f))
        .map((file) => fs.remove(file))
    );
  } catch (e) {
    console.log(e.toString());
    process.exit(1);
  }
})();
