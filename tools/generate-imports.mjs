import shell from 'shelljs';
import fs from 'fs-extra';

/**
 *
 * @param {string} dirname
 * @returns string[]
 */
function findModules(dirname) {
  return fs
    .readdirSync(dirname, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .filter(name => !name.startsWith('__'))
    .sort();
}

shell.echo('generating imports');

for (const f of shell.find('lib/**/*.generated.ts')) {
  fs.removeSync(f);
}

let code = `
import { Datasource } from './common';
const api = new Map<string, Promise<Datasource>>();
export default api;
`;
for (const ds of findModules('lib/datasource')) {
  code += `api.set('${ds}', import('./${ds}'));\n`;
}

fs.writeFileSync('lib/datasource/api.generated.ts', code);
