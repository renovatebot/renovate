import fs from 'fs';
import upath from 'upath';
import { regEx } from './regex';

function relatePath(here: string, there: string): string {
  const thereParts = upath.normalizeTrim(there).split(regEx(/[\\/]/));
  const hereParts = upath.normalizeTrim(here).split(regEx(/[\\/]/));

  let idx = 0;
  while (
    typeof thereParts[idx] === 'string' &&
    typeof hereParts[idx] === 'string' &&
    thereParts[idx] === hereParts[idx]
  ) {
    idx += 1;
  }

  const result = [];
  for (let x = 0; x < hereParts.length - idx; x += 1) {
    result.push('..');
  }
  for (let y = idx; y < thereParts.length; y += 1) {
    result.push(thereParts[idx]);
  }
  return result.join('/');
}

export function loadModules<T>(
  dirname: string,
  validate?: (module: T, moduleName?: string) => boolean,
  filter: (moduleName?: string) => boolean = () => true
): Record<string, T> {
  const result: Record<string, T> = {};

  const moduleNames: string[] = fs
    .readdirSync(dirname, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => !name.startsWith('__'))
    .filter(filter)
    .sort();

  for (const moduleName of moduleNames) {
    const modulePath = upath.join(relatePath(__dirname, dirname), moduleName);
    const module = require(modulePath); // eslint-disable-line
    // istanbul ignore if
    if (!module || (validate && !validate(module, moduleName))) {
      throw new Error(`Invalid module: ${modulePath}`);
    }
    result[moduleName] = module as T;
  }

  return result;
}
