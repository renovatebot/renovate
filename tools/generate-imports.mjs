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

const newFiles = new Set();

shell.echo('generating imports');

let code = `
import { Datasource } from './common';
const api = new Map<string, Promise<Datasource>>();
export default api;
`;
for (const ds of findModules('lib/datasource')) {
  code += `api.set('${ds}', import('./${ds}'));\n`;
}

const oldCode = fs.readFileSync('lib/datasource/api.generated.ts');
if (code !== oldCode) {
  fs.writeFileSync('lib/datasource/api.generated.ts', code);
}
newFiles.add('lib/datasource/api.generated.ts');

for (const file of shell
  .find('lib/**/*.generated.ts')
  .filter(f => !newFiles.has(f))) {
  fs.removeSync(file);
}
