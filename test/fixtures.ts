import type { PathLike } from 'fs';
import callsite from 'callsite';
import { DirectoryJSON, fs, vol } from 'memfs';
import upath from 'upath';

export class Fixtures {
  static get(name: string, fixturesRoot = '.'): string {
    const realFs = jest.requireActual('fs');
    return realFs.readFileSync(
      upath.resolve(Fixtures.getPathToFixtures(fixturesRoot), name),
      {
        encoding: 'utf-8',
      }
    );
  }

  static mock(json: DirectoryJSON, cwd?: string): void {
    vol.fromJSON(json, cwd);
  }

  static toJSON(
    paths?: PathLike | PathLike[],
    json?: Record<string, unknown>,
    isRelative?: boolean
  ): DirectoryJSON {
    return vol.toJSON(paths, json, isRelative);
  }

  static reset(): void {
    vol.reset();
  }

  // Temporary solution, when all tests will be rewritten to Fixtures mocks can be moved into __mocks__ folder
  static fsExtra(): unknown {
    return {
      ...fs,
      pathExists,
      remove: fs.promises.rm,
      readFile: (fileName: string, encoding?: string) =>
        fs.promises.readFile(fileName, encoding ?? 'utf8'),
      writeFile: fs.promises.writeFile,
      outputFile,
    };
  }

  private static getPathToFixtures(fixturesRoot = '.'): string {
    const stack = callsite();
    const callerDir = upath.dirname(stack[2].getFileName());
    return upath.resolve(callerDir, fixturesRoot, '__fixtures__');
  }
}

export async function outputFile(file: string, data: any): Promise<void> {
  const dir = upath.dirname(file);

  if (await pathExists(dir)) {
    await fs.promises.writeFile(file, data);
  } else {
    await fs.promises.mkdir(dir, {
      recursive: true,
    });
    await fs.promises.writeFile(file, data);
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.promises.access(path);
    return true;
  } catch {
    return false;
  }
}
