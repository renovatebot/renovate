import { isOCIRegistry } from './oci.ts';
import {
  isAlias,
  isLocalChartPath,
  parseRepository,
  resolveAlias,
} from './utils.ts';

describe('modules/manager/helmv3/utils', () => {
  describe('.parseRepository()', () => {
    it('applies registryAliases to OCI repositories', () => {
      const dep = parseRepository(
        'chart',
        'oci://mirror.example.com/charts.example.com/org',
        { 'mirror.example.com/charts.example.com': 'charts.example.com' },
      );
      expect(dep.packageName).toBe('charts.example.com/org/chart');
    });

    it('keeps OCI repositories without a matching registryAlias', () => {
      const dep = parseRepository('chart', 'oci://registry.example.com/org', {
        'mirror.example.com': 'charts.example.com',
      });
      expect(dep.packageName).toBe('registry.example.com/org/chart');
    });
  });

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
      // TODO #22198
      const repository = resolveAlias(null as never, {
        anotherRepository: 'https://charts.helm.sh/stable',
      });
      expect(repository).toBeNull();
    });

    it('return repository parameter if repository is undefined', () => {
      // TODO #22198
      const repository = resolveAlias(undefined as never, {
        anotherRepository: 'https://charts.helm.sh/stable',
      });
      expect(repository).toBeUndefined();
    });
  });

  describe('.isAlias()', () => {
    it('return false if repository is null', () => {
      // TODO #22198
      const repository = isAlias(null as never);
      expect(repository).toBeFalse();
    });

    it('return false if repository is undefined', () => {
      // TODO #22198
      const repository = isAlias(undefined as never);
      expect(repository).toBeFalse();
    });
  });

  describe('.isLocalChartPath()', () => {
    it.each`
      path                            | expected
      ${'./x'}                        | ${true}
      ${'../x'}                       | ${true}
      ${'/x'}                         | ${true}
      ${'bitnami/nginx'}              | ${false}
      ${'nginx'}                      | ${false}
      ${'oci://ghcr.io/x'}            | ${false}
      ${'https://example.com/charts'} | ${false}
    `('returns $expected for $path', ({ path, expected }) => {
      expect(isLocalChartPath(path as string)).toBe(expected);
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
