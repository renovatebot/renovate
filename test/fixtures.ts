import type fs from 'fs';
import type { PathLike } from 'fs';
import callsite from 'callsite';
import { DirectoryJSON, fs as memfs, vol } from 'memfs';
import upath from 'upath';

export class Fixtures {
  static get(name: string, fixturesRoot = '.'): string {
    const realFs = jest.requireActual<typeof fs>('fs');
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
  static fsExtra(): any {
    return {
      ...memfs,
      pathExists: jest.fn().mockImplementation(pathExists),
      remove: jest.fn().mockImplementation(memfs.promises.rm),
      readFile: jest.fn().mockImplementation(readFile),
      writeFile: jest.fn().mockImplementation(memfs.promises.writeFile),
      outputFile: jest.fn().mockImplementation(outputFile),
    };
  }

  private static getPathToFixtures(fixturesRoot = '.'): string {
    const stack = callsite();
    const callerDir = upath.dirname(stack[2].getFileName());
    return upath.resolve(callerDir, fixturesRoot, '__fixtures__');
  }
}

function readFile(fileName: string, encoding?: string): Promise<unknown> {
  return memfs.promises.readFile(fileName, encoding ?? 'utf8');
}

export async function outputFile(file: string, data: any): Promise<void> {
  const dir = upath.dirname(file);

  if (await pathExists(dir)) {
    await memfs.promises.writeFile(file, data);
  } else {
    await memfs.promises.mkdir(dir, {
      recursive: true,
    });
    await memfs.promises.writeFile(file, data);
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await memfs.promises.access(path);
    return true;
  } catch {
    return false;
  }
}
