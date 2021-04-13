import { getName } from '../../test/util';
import {
  PLATFORM_TYPE_BITBUCKET,
  PLATFORM_TYPE_GITLAB,
} from '../constants/platforms';
import * as env from './env';
import type { RenovateOptions } from './types';

describe(getName(__filename), () => {
  describe('.getConfig(env)', () => {
    it('returns empty env', () => {
      expect(env.getConfig({})).toEqual({ hostRules: [] });
    });
    it('supports boolean true', () => {
      const envParam: NodeJS.ProcessEnv = { RENOVATE_RECREATE_CLOSED: 'true' };
      expect(env.getConfig(envParam).recreateClosed).toBe(true);
    });
    it('supports boolean false', () => {
      const envParam: NodeJS.ProcessEnv = { RENOVATE_RECREATE_CLOSED: 'false' };
      expect(env.getConfig(envParam).recreateClosed).toBe(false);
    });
    it('supports boolean nonsense as false', () => {
      const envParam: NodeJS.ProcessEnv = { RENOVATE_RECREATE_CLOSED: 'foo' };
      expect(env.getConfig(envParam).recreateClosed).toBe(false);
    });
    delete process.env.RENOVATE_RECREATE_CLOSED;
    it('supports list single', () => {
      const envParam: NodeJS.ProcessEnv = { RENOVATE_LABELS: 'a' };
      expect(env.getConfig(envParam).labels).toEqual(['a']);
    });
    it('supports list multiple', () => {
      const envParam: NodeJS.ProcessEnv = { RENOVATE_LABELS: 'a,b,c' };
      expect(env.getConfig(envParam).labels).toEqual(['a', 'b', 'c']);
    });
    it('supports string', () => {
      const envParam: NodeJS.ProcessEnv = { RENOVATE_TOKEN: 'a' };
      expect(env.getConfig(envParam).token).toBe('a');
    });
    it('supports json', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_LOCK_FILE_MAINTENANCE: '{}',
      };
      expect(env.getConfig(envParam).lockFileMaintenance).toEqual({});
    });
    it('supports GitHub token', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_TOKEN: 'github.com token',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot();
    });
    it('supports GitHub custom endpoint', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_ENDPOINT: 'a ghe endpoint',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot();
    });
    it('supports GitHub custom endpoint and github.com', () => {
      const envParam: NodeJS.ProcessEnv = {
        GITHUB_COM_TOKEN: 'a github.com token',
        RENOVATE_ENDPOINT: 'a ghe endpoint',
        RENOVATE_TOKEN: 'a ghe token',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot();
    });
    it('supports GitHub custom endpoint and gitlab.com', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_ENDPOINT: 'a ghe endpoint',
        RENOVATE_TOKEN: 'a ghe token',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot();
    });
    it('supports GitLab token', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_PLATFORM: PLATFORM_TYPE_GITLAB,
        RENOVATE_TOKEN: 'a gitlab.com token',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot();
    });
    it('supports GitLab custom endpoint', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_PLATFORM: PLATFORM_TYPE_GITLAB,
        RENOVATE_TOKEN: 'a gitlab token',
        RENOVATE_ENDPOINT: 'a gitlab endpoint',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot();
    });
    it('supports Azure DevOps', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_PLATFORM: 'azure',
        RENOVATE_TOKEN: 'an Azure DevOps token',
        RENOVATE_ENDPOINT: 'an Azure DevOps endpoint',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot();
    });
    it('supports docker username/password', () => {
      const envParam: NodeJS.ProcessEnv = {
        DOCKER_USERNAME: 'some-username',
        DOCKER_PASSWORD: 'some-password',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot();
    });
    it('supports Bitbucket token', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_PLATFORM: PLATFORM_TYPE_BITBUCKET,
        RENOVATE_ENDPOINT: 'a bitbucket endpoint',
        RENOVATE_USERNAME: 'some-username',
        RENOVATE_PASSWORD: 'app-password',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot();
    });
    it('supports Bitbucket username/password', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_PLATFORM: PLATFORM_TYPE_BITBUCKET,
        RENOVATE_ENDPOINT: 'a bitbucket endpoint',
        RENOVATE_USERNAME: 'some-username',
        RENOVATE_PASSWORD: 'app-password',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot();
    });
    it('merges full config from env', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_CONFIG: '{"enabled":false,"token":"foo"}',
        RENOVATE_TOKEN: 'a',
      };
      const config = env.getConfig(envParam);
      expect(config.enabled).toBe(false);
      expect(config.token).toBe('a');
    });
  });
  describe('.getEnvName(definition)', () => {
    it('returns empty', () => {
      const option: Partial<RenovateOptions> = {
        name: 'foo',
        env: false,
      };
      expect(env.getEnvName(option)).toEqual('');
    });
    it('returns existing env', () => {
      const option: Partial<RenovateOptions> = {
        name: 'foo',
        env: 'FOO',
      };
      expect(env.getEnvName(option)).toEqual('FOO');
    });
    it('generates RENOVATE_ env', () => {
      const option: Partial<RenovateOptions> = {
        name: 'oneTwoThree',
      };
      expect(env.getEnvName(option)).toEqual('RENOVATE_ONE_TWO_THREE');
    });
  });
});
