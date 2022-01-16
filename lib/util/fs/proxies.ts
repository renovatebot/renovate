import fs from 'fs-extra';
import type { MoveOptions, WriteFileOptions } from 'fs-extra';

// istanbul ignore next
export function stat(path: string | Buffer): Promise<fs.Stats> {
  return fs.stat(path);
}

// istanbul ignore next
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
  return encoding ? fs.readFile(fileName, encoding) : fs.readFile(fileName);
}

// istanbul ignore next
export function writeFile(
  fileName: string,
  fileContent: string
): Promise<void> {
  return fs.writeFile(fileName, fileContent);
}

// istanbul ignore next
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

// istanbul ignore next
export function unlink(path: string | Buffer): Promise<void> {
  return fs.unlink(path);
}

// istanbul ignore next
export function exists(path: string): Promise<boolean> {
  return fs.pathExists(path);
}

// istanbul ignore next
export function pathExists(path: string): Promise<boolean> {
  return fs.pathExists(path);
}

// istanbul ignore next
export function move(
  src: string,
  dest: string,
  options?: MoveOptions
): Promise<void> {
  return fs.move(src, dest, options ?? {});
}

// istanbul ignore next
export function readdir(path: string): Promise<string[]> {
  return fs.readdir(path);
}

// istanbul ignore next
export function rm(
  path: string,
  options?: {
    force?: boolean;
    maxRetries?: number;
    recursive?: boolean;
    retryDelay?: number;
  }
): Promise<void> {
  return fs.rm(path, options);
}
