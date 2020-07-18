import fs from 'fs-extra';
import shell from 'shelljs';

shell.echo('generating imports');
const newFiles = new Set();

if (!fs.existsSync('lib')) {
  shell.echo('> missing sources');
  shell.exit(0);
}

function findModules(dirname: string): string[] {
  return fs
    .readdirSync(dirname, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => !name.startsWith('__'))
    .sort();
}
async function updateFile(file: string, code: string): Promise<void> {
  const oldCode = fs.existsSync(file) ? await fs.readFile(file, 'utf8') : null;
  if (code !== oldCode) {
    await fs.writeFile(file, code);
  }
  newFiles.add(file);
}

function camelCase(input: string): string {
  return input
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (char, index) => {
      return index === 0 ? char.toLowerCase() : char.toUpperCase();
    })
    .replace(/-/g, '');
}

async function generate({
  path,
  types,
  map = '',
  excludes = [],
}: {
  path: string;
  types: string[];
  map?: string;
  excludes?: string[];
}): Promise<void> {
  shell.echo(`> ${path}`);
  let imports = '';
  let maps = '';
  for (const ds of findModules(`lib/${path}`).filter(
    (n) => !excludes?.includes(n)
  )) {
    const name = camelCase(ds);
    imports += `import * as ${name} from './${ds}';\n`;
    maps += `api.set('${ds}', ${name}${map});\n`;
  }

  const code = `import { ${types.join(', ')} } from './common';
    ${imports}\n
    const api = new Map<string, ${types.join(' | ')}>();
    export default api;
    ${maps}`;

  await updateFile(`lib/${path}/api.generated.ts`, code.replace(/^\s+/gm, ''));
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  try {
    // datasources
    await generate({ path: 'datasource', types: ['DatasourceApi'] });

    // managers
    await generate({ path: 'manager', types: ['ManagerApi'] });

    // platform
    await generate({
      path: 'platform',
      types: ['Platform'],
      excludes: ['utils', 'git'],
    });

    // versioning
    await generate({
      path: 'versioning',
      types: ['VersioningApi', 'VersioningApiConstructor'],
      map: '.api',
    });

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
