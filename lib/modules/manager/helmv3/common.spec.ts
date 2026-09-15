import upath from 'upath';
import { GlobalConfig } from '../../../config/global.ts';
import type {
  InternalGlobalConfigOptions,
  RepoGlobalConfig,
} from '../../../config/types.ts';
import * as hostRules from '../../../util/host-rules.ts';
import {
  generateHelmEnvs,
  generateLoginCmd,
  generateRegistryLoginCmd,
} from './common.ts';
import type { RepositoryRule } from './types.ts';

const adminConfig: RepoGlobalConfig & InternalGlobalConfigOptions = {
  // `join` fixes Windows CI
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
};

describe('modules/manager/helmv3/common', () => {
  describe('generateLoginCmd', () => {
    it('should generate a login command with username and password', async () => {
      const repositoryRule: RepositoryRule = {
        name: 'test-repo',
        repository: 'example.com/repo',
        hostRule: {
          hostType: 'docker',
          username: 'testuser',
          password: 'testpass',
        },
      };
      await expect(generateLoginCmd(repositoryRule)).resolves.toEqual(
        'helm registry login --username testuser --password testpass example.com',
      );
    });
  });

  describe('generateRegistryLoginCmd', () => {
    beforeEach(() => {
      hostRules.clear();
    });

    it('generates a login command when a matching host rule exists', async () => {
      hostRules.add({
        hostType: 'docker',
        matchHost: 'registry.example.com',
        username: 'testuser',
        password: 'testpass',
      });

      await expect(
        generateRegistryLoginCmd('test-repo', 'registry.example.com'),
      ).resolves.toBe(
        'helm registry login --username testuser --password testpass registry.example.com',
      );
    });

    it('returns null when no matching host rule exists', async () => {
      await expect(
        generateRegistryLoginCmd('test-repo', 'registry.example.com'),
      ).resolves.toBeNull();
    });

    it('strips a leading oci:// prefix', async () => {
      hostRules.add({
        hostType: 'docker',
        matchHost: 'registry.example.com',
        username: 'testuser',
        password: 'testpass',
      });

      await expect(
        generateRegistryLoginCmd('test-repo', 'oci://registry.example.com'),
      ).resolves.toBe(
        'helm registry login --username testuser --password testpass registry.example.com',
      );
    });

    it('matches the host rule when the registry includes a path', async () => {
      hostRules.add({
        hostType: 'docker',
        matchHost: 'registry.example.com',
        username: 'testuser',
        password: 'testpass',
      });

      await expect(
        generateRegistryLoginCmd('test-repo', 'registry.example.com/charts'),
      ).resolves.toBe(
        'helm registry login --username testuser --password testpass registry.example.com',
      );
    });

    it('matches a host rule scoped to the registry path', async () => {
      hostRules.add({
        hostType: 'docker',
        matchHost: 'https://registry.example.com/charts',
        username: 'testuser',
        password: 'testpass',
      });

      await expect(
        generateRegistryLoginCmd('test-repo', 'registry.example.com/charts'),
      ).resolves.toBe(
        'helm registry login --username testuser --password testpass registry.example.com',
      );
      await expect(
        generateRegistryLoginCmd('test-repo', 'registry.example.com/other'),
      ).resolves.toBeNull();
    });
  });

  describe('generateHelmEnvs', () => {
    const baseEnvs = {
      HELM_REGISTRY_CONFIG: '/tmp/cache/__renovate-private-cache/registry.json',
      HELM_REPOSITORY_CONFIG:
        '/tmp/cache/__renovate-private-cache/repositories.yaml',
      HELM_REPOSITORY_CACHE: '/tmp/cache/__renovate-private-cache/repositories',
    };

    beforeEach(() => {
      GlobalConfig.set(adminConfig);
    });

    it.each`
      helmConstraint | needsExperimentalOci
      ${undefined}   | ${true}
      ${'3.8.0'}     | ${false}
      ${'>=3.7.0'}   | ${false}
      ${'3.7.0'}     | ${true}
      ${'<3.8.0'}    | ${true}
    `(
      'sets HELM_EXPERIMENTAL_OCI=$needsExperimentalOci for constraint "$helmConstraint"',
      ({ helmConstraint, needsExperimentalOci }) => {
        const envs = generateHelmEnvs(helmConstraint);

        expect(envs).toEqual(
          needsExperimentalOci
            ? { ...baseEnvs, HELM_EXPERIMENTAL_OCI: '1' }
            : baseEnvs,
        );
      },
    );
  });
});
