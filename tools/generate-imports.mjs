import fs from 'fs-extra';
import { glob } from 'glob';
import { minimatch } from 'minimatch';
import upath from 'upath';
import { hashFile, hashFromArray } from './utils/hash.mjs';

const newFiles = new Set();

if (!fs.existsSync('lib')) {
  process.exit(0);
}

if (!fs.existsSync('data')) {
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
              !(dirent.isFile() && ['.DS_Store'].includes(dirent.name)),
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
    const hash = await hashFile(filePath, 'sha256');
    return hash;
  } catch {
    throw new Error(`ERROR: Unable to generate hash for ${filePath}`);
  }
}

/**
 *
 * @param {string} managerName
 * @param {boolean} isCustomManager
 * @returns {Promise<string>}
 */
export async function getManagerHash(managerName, isCustomManager) {
  /** @type {string[]} */
  const hashes = [];
  let folderPattern = `lib/modules/manager/${managerName}/**`;
  if (isCustomManager) {
    folderPattern = `lib/modules/manager/custom/${managerName}/**`;
  }

  const files = (await glob(folderPattern)).filter((fileName) =>
    minimatch(fileName, '*.+(snap|spec.ts)', { matchBase: true }),
  );

  // sort files in case glob order changes
  files.sort();

  for (const fileAddr of files) {
    const hash = await getFileHash(fileAddr);
    hashes.push(hash);
  }

  if (hashes.length) {
    return hashFromArray(hashes, 'sha256');
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

    contentMapAssignments.push(`data.set('${key}', ${value});`);
  }

  await updateFile(
    `lib/data-files.generated.ts`,
    [
      `export type DataFile =\n${importDataFileType};`,
      contentMapDecl,
      contentMapAssignments.join('\n'),
      `export default data;\n`,
    ].join('\n\n'),
  );
}

async function generateManagerList() {
  // get managers list
  const managers = (
    await fs.readdir('lib/modules/manager', { withFileTypes: true })
  )
    .filter((file) => file.isDirectory())
    .map((file) => file.name)
    .filter((mgr) => mgr !== 'custom')
    .sort()
    .map((fname) => `"${fname}"`);

  // get custom managers list
  const customManagers = (
    await fs.readdir('lib/modules/manager/custom', { withFileTypes: true })
  )
    .filter((file) => file.isDirectory())
    .map((file) => file.name)
    .sort()
    .map((fname) => `"${fname}"`);

  const content = `
export const AllManagersListLiteral = [${managers.join(',')}] as const;
export type ManagerName = typeof AllManagersListLiteral[number];
export const CustomManagersListLiteral = [${customManagers.join(',')}] as const;
export type CustomManagerName = typeof CustomManagersListLiteral[number];
`;

  await updateFile(`lib/manager-list.generated.ts`, content);
}

async function generateManagerDefaultConfigs() {
  const { default: managers } = await import('../lib/modules/manager/api.ts');
  const { default: customManagers } =
    await import('../lib/modules/manager/custom/api.ts');

  const allManagers = new Map([
    ...managers.entries(),
    ...customManagers.entries(),
  ]);
  /** @type {Record<string, Record<string, unknown>>} */
  const managerDefaultConfigs = {};
  for (const [name, manager] of allManagers) {
    if (manager.defaultConfig) {
      managerDefaultConfigs[name] = manager.defaultConfig;
    }
  }

  const content = `
export const managerDefaultConfigs: Record<string, Record<string, unknown>> = ${JSON.stringify(managerDefaultConfigs, null, 2)};
`;

  await updateFile('lib/manager-default-configs.generated.ts', content);
}

async function generateVersioningList() {
  const versionings = (
    await fs.readdir('lib/modules/versioning', { withFileTypes: true })
  )
    .filter((file) => file.isDirectory())
    .map((file) => file.name)
    .sort()
    .map((fname) => `"${fname}"`);

  const content = `
export const AllVersioningsListLiteral = [${versionings.join(',')}] as const;
export type VersioningName = typeof AllVersioningsListLiteral[number];
`;

  await updateFile(`lib/versioning-list.generated.ts`, content);
}

async function generateDatasourceList() {
  const datasources = (
    await fs.readdir('lib/modules/datasource', { withFileTypes: true })
  )
    .filter((file) => file.isDirectory() && !file.name.startsWith('__'))
    .map((file) => file.name)
    .sort()
    .map((fname) => `"${fname}"`);

  const content = `
export const AllDatasourcesListLiteral = [${datasources.join(',')}] as const;
export type DatasourceName = typeof AllDatasourcesListLiteral[number];
`;

  await updateFile(`lib/datasource-list.generated.ts`, content);
}

async function generateGlobalConfigOptionDefaults() {
  const { getOptions } = await import('../lib/config/options/index.ts');
  const options = getOptions();

  /** @type {Record<string, unknown>} */
  const defaults = {};
  for (const option of options
    .filter((o) => o.globalOnly)
    .filter((o) => 'default' in o)
    // if the default is null, it means there is no default, so don't include it
    .filter((o) => o.default !== null)
    .sort((a, b) => a.name.localeCompare(b.name))) {
    defaults[option.name] = option.default;
  }

  const content = `
export const globalConfigOptionDefaults: Record<string, unknown> = ${JSON.stringify(defaults, null, 2)};
`;

  await updateFile('lib/global-config-option-defaults.generated.ts', content);
}

async function generateHash() {
  try {
    const hashMap = `export const hashMap = new Map<string, string>();`;
    /** @type {Record<string, string>[]} */
    const hashes = [];
    // get managers list
    const managers = (
      await fs.readdir('lib/modules/manager', { withFileTypes: true })
    )
      .filter((file) => file.isDirectory())
      .map((file) => file.name)
      .filter((mgr) => mgr !== 'custom');

    const customManagers = (
      await fs.readdir('lib/modules/manager/custom', { withFileTypes: true })
    )
      .filter((file) => file.isDirectory())
      .map((file) => file.name);

    for (const manager of managers) {
      const hash = await getManagerHash(manager, false);
      hashes.push({ manager, hash });
    }

    for (const manager of customManagers) {
      const hash = await getManagerHash(manager, true);
      hashes.push({ manager, hash });
    }

    //add manager hashes to hashMap {key->manager, value->hash}
    const hashStrings = hashes.map(
      ({ manager, hash }) => `hashMap.set('${manager}','${hash}');`,
    );

    //write hashMap to fingerprint.generated.ts
    await updateFile(
      'lib/modules/manager/fingerprint.generated.ts',
      [hashMap, hashStrings.join('\n')].join('\n\n'),
    );
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

await (async () => {
  try {
    // prevent import cycles when trying to generate config options
    const stubFile = 'lib/global-config-option-defaults.generated.ts';
    if (!fs.existsSync(stubFile)) {
      await fs.writeFile(
        stubFile,
        '\nexport const globalConfigOptionDefaults: Record<string, unknown> = {};\n',
      );
    }

    // data-files
    await generateData();
    await generateManagerList();
    await generateManagerDefaultConfigs();
    await generateVersioningList();
    await generateDatasourceList();
    await generateGlobalConfigOptionDefaults();
    await generateHash();
    await Promise.all(
      (await glob('lib/**/*.generated.ts'))
        .map((f) => upath.join(f))
        .filter((f) => !newFiles.has(f))
        .map(async (file) => {
          await fs.remove(file);
        }),
    );
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
