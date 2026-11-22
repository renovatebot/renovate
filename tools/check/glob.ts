import { Minimatch } from 'minimatch';

export function compileGlob(pattern: string): Minimatch {
  return new Minimatch(pattern, {
    dot: true,
    nocomment: true,
    nonegate: true,
    noext: true,
    platform: 'linux',
  });
}
