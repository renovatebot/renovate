/* eslint-disable @typescript-eslint/no-var-requires */
const shell = require('shelljs');
const fs = require('fs');

/**
 *
 * @param {string} dirname
 * @returns string[]
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function findModules(dirname) {
  return fs
    .readdirSync(dirname, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .filter(name => !name.startsWith('__'))
    .sort();
}

shell.echo('generating imports');
let code = `
import { Datasource } from '../lib/datasource/common';
const api = new Map<string,Promise<Datasource>>();
export default api;
`;
for (const ds of findModules('lib/datasource')) {
  code += `api.set('${ds}', import('../lib/datasource/${ds}'));\n`;
}

fs.writeFileSync('tools/api.generated.ts', code);
