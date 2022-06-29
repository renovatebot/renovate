import { RE_REPOSITORY_GENERIC_GIT_SSH_FORMAT } from './common';

describe('modules/manager/puppet/common', () => {
  describe('RE_REPOSITORY_GENERIC_GIT_SSH_FORMAT', () => {
    it('access by index', () => {
      const regex = RE_REPOSITORY_GENERIC_GIT_SSH_FORMAT.exec(
        'git@gitlab.com:dir1/dir2/project.git'
      );
      expect(regex).not.toBeNull();
      expect(String(regex)).toBe(
        'git@gitlab.com:dir1/dir2/project.git,dir1/dir2/project.git'
      );
    });

    it('access by named group', () => {
      const regex = RE_REPOSITORY_GENERIC_GIT_SSH_FORMAT.exec(
        'git@gitlab.com:dir1/dir2/project.git'
      );
      expect(regex).not.toBeNull();
      expect(String(regex)).toBe(
        'git@gitlab.com:dir1/dir2/project.git,dir1/dir2/project.git'
      );
      expect(regex?.groups).not.toBeNull();
      expect(regex?.groups?.repository).toBe('dir1/dir2/project.git');
    });
  });
});
