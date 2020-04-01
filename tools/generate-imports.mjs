import shell from 'shelljs';
import fs from 'fs-extra';
import _ from 'lodash';

shell.echo('generating imports');
const newFiles = new Set();

if (!fs.existsSync('lib')) {
  shell.echo('> missing sources');
  shell.exit(0);
}

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

shell.echo('> datasources');
let code = `
import { Datasource } from './common';
const api = new Map<string, Promise<Datasource>>();
export default api;
`;
for (const ds of findModules('lib/datasource')) {
  code += `api.set('${ds}', import('./${ds}'));\n`;
}
updateFile('lib/datasource/api.generated.ts', code);

shell.echo('> managers');
let imports = '';
let maps = '';
for (const ds of findModules('lib/manager')) {
  const name = _.camelCase(ds);
  imports += `import * as ${name} from './${ds}';\n`;
  maps += `api.set('${ds}', ${name});\n`;
}

code = `import { ManagerApi } from './common';
${imports}
const api = new Map<string, ManagerApi>();
export default api;
${maps}`;
updateFile('lib/manager/api.generated.ts', code);

for (const file of shell
  .find('lib/**/*.generated.ts')
  .filter(f => !newFiles.has(f))) {
  fs.removeSync(file);
}

for (const file of shell
  .find('lib/**/*.generated.ts')
  .filter(f => !newFiles.has(f))) {
  fs.removeSync(file);
}
