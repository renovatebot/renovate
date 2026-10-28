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
