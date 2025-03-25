import type { PathLike, Stats } from 'node:fs';
import callsite from 'callsite';
import type { DirectoryJSON } from 'memfs';
import { fs as memfs, vol } from 'memfs';
import type { TDataOut } from 'memfs/lib/encoding';
import upath from 'upath';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const realFs: typeof import('node:fs') = require('node:fs'); // used to bypass vitest mock

/**
 * Class to work with in-memory file-system
 */
export class Fixtures {
  /**
   * Returns content from fixture file from __fixtures__ folder
   * @param name name of the fixture file
   * @param [fixturesRoot] - Where to find the fixtures, uses the current test folder by default
   * @returns
   */
  static get(name: string, fixturesRoot = '.'): string {
    return realFs.readFileSync(
      upath.resolve(Fixtures.getPathToFixtures(fixturesRoot), name),
      {
        encoding: 'utf-8',
      },
    );
  }

  /**
   *  Returns path to fixture file in __fixtures__ folder
   * @param name name of the fixture file
   * @param [fixturesRoot] - Where to find the fixtures, uses the current test folder by default
   * @return path to the fixture
   */
  static getPath(name: string, fixturesRoot = '.'): string {
    return upath.resolve(Fixtures.getPathToFixtures(fixturesRoot), name);
  }

  /**
   * Returns content from fixture file from __fixtures__ folder as `Buffer`
   * @param name name of the fixture file
   * @param [fixturesRoot] - Where to find the fixtures, uses the current test folder by default
   * @returns
   */
  static getBinary(name: string, fixturesRoot = '.'): Buffer {
    return realFs.readFileSync(
      upath.resolve(Fixtures.getPathToFixtures(fixturesRoot), name),
    );
  }

  /**
   * Returns content from fixture file from __fixtures__ folder and parses as JSON
   * @param name name of the fixture file
   * @param [fixturesRoot] - Where to find the fixtures, uses the current test folder by default
   * @returns
   */
  static getJson<T = any>(name: string, fixturesRoot = '.'): T {
    return JSON.parse(
      realFs.readFileSync(
        upath.resolve(Fixtures.getPathToFixtures(fixturesRoot), name),
        {
          encoding: 'utf-8',
        },
      ),
    ) as T;
  }

  /**
   * Adds files from a flat json object to the file-system
   * @param json flat object
   * @param cwd is an optional string used to compute absolute file paths, if a file path is given in a relative form
   */
  static mock(json: DirectoryJSON, cwd?: string): void {
    vol.fromJSON(json, cwd);
  }

  /**
   * Exports the whole contents of the volume recursively to a flat JSON object
   * @param paths is an optional argument that specifies one or more paths to be exported. If this argument is omitted, the whole volume is exported. paths can be an array of paths. A path can be a string, Buffer or an URL object.
   * @param json is an optional object parameter which will be populated with the exported files
   * @param isRelative is boolean that specifies if returned paths should be relative
   * @returns
   */
  static toJSON(
    paths?: PathLike | PathLike[],
    json?: Record<string, unknown>,
    isRelative?: boolean,
  ): DirectoryJSON {
    return vol.toJSON(paths, json, isRelative);
  }

  /**
   * Removes all files from the volume.
   */
  static reset(): void {
    vol.reset();
    fsExtraMock.pathExists.mockReset();
    fsExtraMock.remove.mockReset();
    fsExtraMock.removeSync.mockReset();
    fsExtraMock.readFile.mockReset();
    fsExtraMock.writeFile.mockReset();
    fsExtraMock.outputFile.mockReset();
    fsExtraMock.stat.mockReset();
    fsExtraMock.chmod.mockReset();
    fsExtraMock.ensureDir.mockReset();
  }

  private static getPathToFixtures(fixturesRoot = '.'): string {
    const stack = callsite();
    const callerDir = upath.dirname(stack[2].getFileName());
    return upath.resolve(callerDir, fixturesRoot, '__fixtures__');
  }
}

const fsExtraMock = {
  pathExists: vi.fn(pathExists),
  remove: vi.fn(memfs.promises.rm),
  removeSync: vi.fn(memfs.rmSync),
  readFile: vi.fn(readFile),
  writeFile: vi.fn(memfs.promises.writeFile),
  outputFile: vi.fn(outputFile),
  stat: vi.fn(stat),
  chmod: vi.fn(memfs.promises.chmod),
  // See fs-extra
  ensureDir: vi.fn((path) =>
    memfs.promises.mkdir(path, { recursive: true, mode: 0o777 }),
  ),
};

// Temporary solution, when all tests will be rewritten to Fixtures mocks can be moved into __mocks__ folder
export function fsExtra(): any {
  const fs = {
    ...memfs,
    ...fsExtraMock,
  };
  return { ...fs, default: fs };
}

export function readFile(fileName: string, options: any): Promise<TDataOut> {
  if (fileName.endsWith('.wasm') || fileName.endsWith('.wasm.gz')) {
    return realFs.promises.readFile(fileName, options);
  }

  return memfs.promises.readFile(fileName, options);
}

export async function outputFile(
  file: string,
  data: string | Buffer | Uint8Array,
): Promise<void> {
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

async function stat(path: string): Promise<Stats> {
  // memfs type mismatch
  return (await memfs.promises.stat(path)) as Stats;
}
