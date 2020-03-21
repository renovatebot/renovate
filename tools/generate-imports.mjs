import shell from 'shelljs';
import fs from 'fs-extra';

shell.echo('generating imports');
const newFiles = new Set();

function findModules(dirname) {
  return fs
    .readdirSync(dirname, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .filter(name => !name.startsWith('__'))
    .sort();
}
function updateFile(file, code) {
  const oldCode = fs.existsSync(file) ? fs.readFileSync(file) : null;
  if (code !== oldCode) {
    fs.writeFileSync(file, code);
  }
  newFiles.add(file);
}

let code = `
import { Datasource } from './common';
const api = new Map<string, Promise<Datasource>>();
export default api;
`;
for (const ds of findModules('lib/datasource')) {
  code += `api.set('${ds}', import('./${ds}'));\n`;
}

updateFile('lib/datasource/api.generated.ts', code);

for (const file of shell
  .find('lib/**/*.generated.ts')
  .filter(f => !newFiles.has(f))) {
  fs.removeSync(file);
}
