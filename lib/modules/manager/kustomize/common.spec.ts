import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { generateHelmEnvs } from './common';

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
};

describe('modules/manager/kustomize/common', () => {
  beforeEach(() => {
    GlobalConfig.set(adminConfig);
  });

  describe('generateHelmEnvs', () => {
    it('generates envs for specific helm version not requiring HELM_EXPERIMENTAL_OCI', () => {
      const config = {
        constraints: { helm: '3.8.0' },
      };
      const envs = generateHelmEnvs(config);
      expect(envs).toEqual({
        HELM_REGISTRY_CONFIG:
          '/tmp/cache/__renovate-private-cache/registry.json',
        HELM_REPOSITORY_CONFIG:
          '/tmp/cache/__renovate-private-cache/repositories.yaml',
        HELM_REPOSITORY_CACHE:
          '/tmp/cache/__renovate-private-cache/repositories',
      });
    });

    it('generates envs for helm version range not requiring HELM_EXPERIMENTAL_OCI', () => {
      const config = {
        constraints: { helm: '>=3.7.0' },
      };
      const envs = generateHelmEnvs(config);
      expect(envs).toEqual({
        HELM_REGISTRY_CONFIG:
          '/tmp/cache/__renovate-private-cache/registry.json',
        HELM_REPOSITORY_CONFIG:
          '/tmp/cache/__renovate-private-cache/repositories.yaml',
        HELM_REPOSITORY_CACHE:
          '/tmp/cache/__renovate-private-cache/repositories',
      });
    });

    it('generates envs for specific helm version requiring HELM_EXPERIMENTAL_OCI', () => {
      const config = {
        constraints: { helm: '3.7.0' },
        postUpdateOptions: ['kustomizeInflateHelmCharts'],
      };
      const envs = generateHelmEnvs(config);
      expect(envs).toEqual({
        HELM_REGISTRY_CONFIG:
          '/tmp/cache/__renovate-private-cache/registry.json',
        HELM_REPOSITORY_CONFIG:
          '/tmp/cache/__renovate-private-cache/repositories.yaml',
        HELM_REPOSITORY_CACHE:
          '/tmp/cache/__renovate-private-cache/repositories',
        HELM_EXPERIMENTAL_OCI: '1',
      });
    });

    it('generates envs for helm range version requiring HELM_EXPERIMENTAL_OCI', () => {
      const config = {
        constraints: { helm: '<3.8.0' },
        postUpdateOptions: ['kustomizeInflateHelmCharts'],
      };
      const envs = generateHelmEnvs(config);
      expect(envs).toEqual({
        HELM_REGISTRY_CONFIG:
          '/tmp/cache/__renovate-private-cache/registry.json',
        HELM_REPOSITORY_CONFIG:
          '/tmp/cache/__renovate-private-cache/repositories.yaml',
        HELM_REPOSITORY_CACHE:
          '/tmp/cache/__renovate-private-cache/repositories',
        HELM_EXPERIMENTAL_OCI: '1',
      });
    });
  });
});
