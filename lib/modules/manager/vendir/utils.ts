import upath from 'upath';

export function isFileInDir(dir: string, file: string): boolean {
  return upath.dirname(file) === dir;
}

// TODO: Add Support for Registry Aliases (See Helmv3 for possible implementation)
