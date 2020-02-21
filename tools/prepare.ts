import shell from 'shelljs';
import { existsSync, readFileSync, writeFileSync } from 'fs';

const force = process.argv.some(s => s === '--force' || s === '-f');
const restore = process.argv.some(s => s === '--restore' || s === '-r');

function patchJest(): void {
  const file = 'node_modules/jest-runtime/build/index.js';
  if (existsSync(`${file}.bak`)) {
    if (!force) {
      shell.echo('Found backup, not patching jest-runtime.');
      return;
    }
    shell.echo('Found backup, restore jest-runtime.');
    shell.cp(`${file}.bak`, file);
  }
  if (restore) return;

  shell.echo('-n', 'Patching jest-runtime ... ');

  let code = readFileSync(file, 'utf-8');

  let idx = code.indexOf('_requireCoreModule(moduleName)');

  if (idx < 0) return;

  const orig = 'return require(moduleName);';
  idx = code.indexOf(orig);

  if (idx < 0) return;

  const patched = `if (!this._coreModulesProxyCache) {
      this._coreModulesProxyCache = Object.create(null);
    }

    if (this._coreModulesProxyCache[moduleName]) {
      return this._coreModulesProxyCache[moduleName];
    }

    const mod = require(moduleName);
    const forbidden = ['http', 'https'];
    const warned = this._warned = this._warned || Object.create(null);


    const set = (
      target,
      property,
      value,
      receiver,
    ) => {
      if (target !== mod || typeof value !== 'function' || value._isMockFunction || forbidden.some(s => s === moduleName))
        return Reflect.set(target, property, value, receiver);
      if (!warned[moduleName + '_' + property]){
        console.warn('Patching module not allowed', moduleName, property);
        warned[moduleName + '_' + property] = true;
      }
      return true;
    };

    return this._coreModulesProxyCache[moduleName] = new Proxy(mod, {set});
  `;

  code = code.slice(0, idx) + patched + code.slice(idx + orig.length);

  shell.cp(file, `${file}.bak`);
  writeFileSync(file, code);
  shell.echo('done.');
}

patchJest();
