import { SimpleGitOptions } from 'simple-git';

export function simpleGitConfig(): Partial<SimpleGitOptions> {
  return {
    completion: {
      onClose: true,
      onExit: false,
    },
  };
}
