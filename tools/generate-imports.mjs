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

const oldFiles = new Set(shell.find('lib/**/*.generated.ts'));

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
oldFiles.delete('lib/datasource/api.generated.ts');

for (const f of oldFiles) {
  fs.removeSync(f);
}
