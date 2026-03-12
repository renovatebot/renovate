import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import upath from 'upath';

// TODO: move to `test/util.ts` or `test/modules.ts`

export async function loadModules<T>(
  dirname: string,
  validate?: (module: T, moduleName: string) => boolean,
  filter: (moduleName: string) => boolean = () => true,
): Promise<Record<string, T>> {
  const result: Record<string, T> = {};

  const moduleNames: string[] = fs
    .readdirSync(dirname, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => !name.startsWith('__'))
    .filter(filter)
    .sort();

  for (const moduleName of moduleNames) {
    const modulePath = upath.join(dirname, moduleName);
    const moduleUrl = pathToFileURL(modulePath).href;
    const module = await import(moduleUrl);
    // istanbul ignore if
    if (!module || (validate && !validate(module, moduleName))) {
      throw new Error(`Invalid module: ${modulePath}`);
    }
    result[moduleName] = module as T;
  }

  return result;
}
