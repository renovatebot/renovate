import fs from 'fs-extra';
import type { WriteFileOptions } from 'fs-extra';

// istanbul ignore next
export function stat(path: string | Buffer): Promise<fs.Stats> {
  return fs.stat(path);
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
export function outputFile(
  file: string,
  data: unknown,
  options?: WriteFileOptions | string
): Promise<void> {
  return fs.outputFile(file, data, options ?? {});
}

// istanbul ignore next
export function unlink(path: string | Buffer): Promise<void> {
  return fs.unlink(path);
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
