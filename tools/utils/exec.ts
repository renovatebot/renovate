import type { Options, Result } from 'execa';
import { execa } from 'execa';

const maxBuffer = 20 * 1024 * 1024;

/** execa options producing text output, which excludes the binary encodings */
export type TextOptions = Extract<
  Options,
  { readonly encoding?: 'utf8' | 'utf16le' }
>;

/**
 * Execute a command asynchronously using execa
 */
export async function exec<T extends TextOptions = Record<never, never>>(
  cmd: string,
  args: string[] = [],
  opts?: T,
): Promise<Result<T & { encoding: 'utf8' }>> {
  const options = { ...opts, maxBuffer, encoding: 'utf8' } as T & {
    encoding: 'utf8';
  };
  return await execa(cmd, args, options);
}

/**
 * Creates an error without stack trace, for failures whose output is already
 * in the log.
 */
export function commandError(message: string): Error {
  const err = new Error(message);
  err.stack = `${err.name}: ${err.message}`;
  return err;
}

/**
 * Runs a command with its output going straight to the log and throws a
 * one-line error when it fails.
 */
export async function run(cmd: string, args: string[] = []): Promise<void> {
  const result = await execa(cmd, args, { reject: false, stdio: 'inherit' });
  if (result.failed) {
    throw commandError(result.shortMessage ?? `Command failed: ${cmd}`);
  }
}
