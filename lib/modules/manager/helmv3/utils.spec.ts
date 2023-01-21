import { isAlias, isOCIRegistry, resolveAlias } from './utils';

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
      // TODO #7154
      const repository = resolveAlias(null as never, {
        anotherRepository: 'https://charts.helm.sh/stable',
      });
      expect(repository).toBeNull();
    });

    it('return repository parameter if repository is undefined', () => {
      // TODO #7154
      const repository = resolveAlias(undefined as never, {
        anotherRepository: 'https://charts.helm.sh/stable',
      });
      expect(repository).toBeUndefined();
    });
  });

  describe('.isAlias()', () => {
    it('return false if repository is null', () => {
      // TODO #7154
      const repository = isAlias(null as never);
      expect(repository).toBeFalse();
    });

    it('return false if repository is undefined', () => {
      // TODO #7154
      const repository = isAlias(undefined as never);
      expect(repository).toBeFalse();
    });
  });

  describe('.isOCIRegistry()', () => {
    it('return false if repository is null', () => {
      const repository = isOCIRegistry(null);
      expect(repository).toBeFalse();
    });

    it('return false if repository is undefined', () => {
      const repository = isOCIRegistry(undefined);
      expect(repository).toBeFalse();
    });
  });
});
