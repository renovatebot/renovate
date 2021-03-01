import * as fs from 'fs-extra';
import { MoveOptions, WriteFileOptions } from 'fs-extra';

/* c8 ignore next */
export function stat(path: string | Buffer): Promise<fs.Stats> {
  return fs.stat(path);
}

/* c8 ignore next */
export function chmod(
  path: string | Buffer,
  mode: string | number
): Promise<void> {
  return fs.chmod(path, mode);
}

export async function readFile(fileName: string): Promise<Buffer>;
export async function readFile(
  fileName: string,
  encoding: 'utf8'
): Promise<string>;
export function readFile(
  fileName: string,
  encoding?: string
): Promise<string | Buffer> {
  return fs.readFile(fileName, encoding);
}

/* c8 ignore next */
export function writeFile(
  fileName: string,
  fileContent: string
): Promise<void> {
  return fs.writeFile(fileName, fileContent);
}

/* c8 ignore next */
export function outputFile(
  file: string,
  data: unknown,
  options?: WriteFileOptions | string
): Promise<void> {
  return fs.outputFile(file, data, options ?? {});
}

export function remove(dir: string): Promise<void> {
  return fs.remove(dir);
}

/* c8 ignore next */
export function unlink(path: string | Buffer): Promise<void> {
  return fs.unlink(path);
}

/* c8 ignore next */
export function exists(path: string): Promise<boolean> {
  return fs.pathExists(path);
}

/* c8 ignore next */
export function pathExists(path: string): Promise<boolean> {
  return fs.pathExists(path);
}

/* c8 ignore next */
export function move(
  src: string,
  dest: string,
  options?: MoveOptions
): Promise<void> {
  return fs.move(src, dest, options ?? {});
}
