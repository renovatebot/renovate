import upath from 'upath';
import { GlobalConfig } from '../../../config/global.ts';
import type {
  InternalGlobalConfigOptions,
  RepoGlobalConfig,
} from '../../../config/types.ts';
import { logger } from '../../../logger/index.ts';
import { generateHelmEnvs, generateLoginCmd } from './common.ts';
import type { RepositoryRule } from './types.ts';

const adminConfig: RepoGlobalConfig & InternalGlobalConfigOptions = {
  // `join` fixes Windows CI
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
};

describe('modules/manager/helmv3/common', () => {
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

  it('does not log the login command', async () => {
    const repositoryRule: RepositoryRule = {
      name: 'test-repo',
      repository: 'example.com/repo',
      hostRule: {
        hostType: 'docker',
        username: 'testuser',
        password: 'testpass',
      },
    };
    await generateLoginCmd(repositoryRule);
    expect(logger.trace).toHaveBeenCalledWith(
      { host: 'example.com' },
      'Generated Helm registry login command',
    );
    expect(logger.trace).not.toHaveBeenCalledWith(
      expect.objectContaining({ cmd: expect.stringContaining('testpass') }),
      expect.anything(),
    );
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
