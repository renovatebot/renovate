import type { PathLike } from 'fs';
import callsite from 'callsite';
import { DirectoryJSON, IFs, fs, vol } from 'memfs';
import upath from 'upath';

export class Fixtures {
  static get(name: string): string {
    const realFs = jest.requireActual('fs');
    return realFs.readFileSync(upath.resolve(Fixtures.pathToFixtures, name), {
      encoding: 'utf-8',
    });
  }

  static mock(json: DirectoryJSON, cwd?: string): void {
    vol.fromJSON(json, cwd);
  }

  static toJSON(
    paths?: PathLike | PathLike[],
    json?: unknown,
    isRelative?: boolean
  ): DirectoryJSON {
    return vol.toJSON(paths, json, isRelative);
  }

  static reset(): void {
    vol.reset();
  }

  // Temporary solution, when all tests will be rewritten to Fixtures mocks can be moved into __mocks__ folder
  static fs(): IFs {
    return fs;
  }

  static fsExtra(): unknown {
    function pathExists(path: string): boolean {
      try {
        fs.accessSync(path);
        return true;
      } catch {
        return false;
      }
    }

    return {
      ...fs,
      pathExists,
      readFile: (path: string) => fs.readFileSync(path, 'utf-8'),
      writeFile: (name: string, content: string) =>
        fs.writeFileSync(name, content),
    };
  }

  private static get pathToFixtures(): string {
    const stack = callsite();
    const dirname = upath.dirname(stack[2].getFileName());
    return upath.resolve(dirname, '__fixtures__');
  }
}
