import { isAlias, resolveAlias } from './utils';

describe('modules/manager/helmv3/utils', () => {
  describe('.resolveAlias()', () => {
    it('return alias with "alias:"', () => {
      const repoUrl = 'https://charts.helm.sh/stable';
      const repository = resolveAlias('alias:testRepo', {
        testRepo: repoUrl,
      });
      expect(repository).toBe(repoUrl);
    });

    it('return alias with "@"', () => {
      const repoUrl = 'https://charts.helm.sh/stable';
      const repository = resolveAlias('@testRepo', {
        testRepo: repoUrl,
      });
      expect(repository).toBe(repoUrl);
    });

    it('return null if alias repo is not defined', () => {
      const repository = resolveAlias('alias:testRepo', {
        anotherRepository: 'https://charts.helm.sh/stable',
      });
      expect(repository).toBeNull();
    });

    it('return resolved repository on OCI registries', () => {
      const repository = resolveAlias('alias:artifactory', {
        artifactory: 'oci://artifactory.example.com',
      });
      expect(repository).toBe('oci://artifactory.example.com');
    });

    it('return repository parameter if it is not an alias', () => {
      const repoUrl = 'https://registry.example.com';
      const repository = resolveAlias(repoUrl, {
        anotherRepository: 'https://charts.helm.sh/stable',
      });
      expect(repository).toBe(repoUrl);
    });

    it('return repository parameter if repository is null', () => {
      const repository = resolveAlias(null, {
        anotherRepository: 'https://charts.helm.sh/stable',
      });
      expect(repository).toBeNull();
    });

    it('return repository parameter if repository is undefined', () => {
      const repository = resolveAlias(undefined, {
        anotherRepository: 'https://charts.helm.sh/stable',
      });
      expect(repository).toBeUndefined();
    });
  });

  describe('.isAlias()', () => {
    it('return false if repository is null', () => {
      const repository = isAlias(null);
      expect(repository).toBeFalse();
    });

    it('return false if repository is undefined', () => {
      const repository = isAlias(undefined);
      expect(repository).toBeFalse();
    });
  });
});
