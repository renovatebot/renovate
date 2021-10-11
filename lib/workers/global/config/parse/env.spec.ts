import type { RenovateOptions } from '../../../../config/types';
import { PlatformId } from '../../../../constants';
import { logger } from '../../../../logger';
import * as env from './env';

describe('workers/global/config/parse/env', () => {
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
    it('supports custom prefixes', () => {
      const envParam: NodeJS.ProcessEnv = {
        ENV_PREFIX: 'FOOBAR_',
        FOOBAR_TOKEN: 'abc',
      };
      const res = env.getConfig(envParam);
      expect(res).toMatchObject({ token: 'abc' });
    });
    it('supports json', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_LOCK_FILE_MAINTENANCE: '{}',
      };
      expect(env.getConfig(envParam).lockFileMaintenance).toEqual({});
    });
    it('supports arrays of objects', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_HOST_RULES: JSON.stringify([{ foo: 'bar' }]),
      };
      const res = env.getConfig(envParam);
      expect(res).toMatchObject({ hostRules: [{ foo: 'bar' }] });
    });
    it('skips misconfigured arrays', () => {
      const envName = 'RENOVATE_HOST_RULES';
      const val = JSON.stringify('foobar');
      const envParam: NodeJS.ProcessEnv = { [envName]: val };

      const res = env.getConfig(envParam);

      expect(res).toEqual({ hostRules: [] });
      expect(logger.debug).toHaveBeenLastCalledWith(
        { val, envName },
        'Could not parse object array'
      );
    });
    it('skips garbage array values', () => {
      const envName = 'RENOVATE_HOST_RULES';
      const val = '!@#';
      const envParam: NodeJS.ProcessEnv = { [envName]: val };

      const res = env.getConfig(envParam);

      expect(res).toEqual({ hostRules: [] });
      expect(logger.debug).toHaveBeenLastCalledWith(
        { val, envName },
        'Could not parse environment variable'
      );
    });
    it('supports GitHub token', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_TOKEN: 'github.com token',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot({
        token: 'github.com token',
      });
    });
    it('supports GitHub custom endpoint', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_ENDPOINT: 'a ghe endpoint',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot({
        endpoint: 'a ghe endpoint',
      });
    });
    it('supports GitHub custom endpoint and github.com', () => {
      const envParam: NodeJS.ProcessEnv = {
        GITHUB_COM_TOKEN: 'a github.com token',
        RENOVATE_ENDPOINT: 'a ghe endpoint',
        RENOVATE_TOKEN: 'a ghe token',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot({
        endpoint: 'a ghe endpoint',
        hostRules: [
          {
            hostType: 'github',
            matchHost: 'github.com',
            token: 'a github.com token',
          },
        ],
        token: 'a ghe token',
      });
    });
    it('supports GitHub custom endpoint and gitlab.com', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_ENDPOINT: 'a ghe endpoint',
        RENOVATE_TOKEN: 'a ghe token',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot({
        endpoint: 'a ghe endpoint',
        token: 'a ghe token',
      });
    });
    it('supports GitLab token', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_PLATFORM: PlatformId.Gitlab,
        RENOVATE_TOKEN: 'a gitlab.com token',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot({
        platform: 'gitlab',
        token: 'a gitlab.com token',
      });
    });
    it('supports GitLab custom endpoint', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_PLATFORM: PlatformId.Gitlab,
        RENOVATE_TOKEN: 'a gitlab token',
        RENOVATE_ENDPOINT: 'a gitlab endpoint',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot({
        endpoint: 'a gitlab endpoint',
        platform: 'gitlab',
        token: 'a gitlab token',
      });
    });
    it('supports Azure DevOps', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_PLATFORM: 'azure',
        RENOVATE_TOKEN: 'an Azure DevOps token',
        RENOVATE_ENDPOINT: 'an Azure DevOps endpoint',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot({
        endpoint: 'an Azure DevOps endpoint',
        platform: 'azure',
        token: 'an Azure DevOps token',
      });
    });
    it('supports docker username/password', () => {
      const envParam: NodeJS.ProcessEnv = {
        DOCKER_USERNAME: 'some-username',
        DOCKER_PASSWORD: 'some-password',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot({
        hostRules: [
          {
            hostType: 'docker',
            password: 'some-password',
            username: 'some-username',
          },
        ],
      });
    });
    it('supports password-only', () => {
      const envParam: NodeJS.ProcessEnv = {
        NPM_PASSWORD: 'some-password',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot({
        hostRules: [{ hostType: 'npm', password: 'some-password' }],
      });
    });
    it('supports domain and host names with case insensitivity', () => {
      const envParam: NodeJS.ProcessEnv = {
        GITHUB__TAGS_GITHUB_COM_TOKEN: 'some-token',
        pypi_my_CUSTOM_HOST_passWORD: 'some-password',
      };
      const res = env.getConfig(envParam);
      expect(res).toMatchSnapshot({
        hostRules: [
          { matchHost: 'github.com', token: 'some-token' },
          { matchHost: 'my.custom.host', password: 'some-password' },
        ],
      });
    });
    it('regression test for #10937', () => {
      const envParam: NodeJS.ProcessEnv = {
        GIT__TAGS_GITLAB_EXAMPLE__DOMAIN_NET_USERNAME: 'some-user',
        GIT__TAGS_GITLAB_EXAMPLE__DOMAIN_NET_PASSWORD: 'some-password',
      };
      const res = env.getConfig(envParam);
      expect(res).toMatchObject({
        hostRules: [
          {
            hostType: 'git-tags',
            matchHost: 'gitlab.example-domain.net',
            password: 'some-password',
            username: 'some-user',
          },
        ],
      });
    });
    it('supports datasource env token', () => {
      const envParam: NodeJS.ProcessEnv = {
        PYPI_TOKEN: 'some-token',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot({
        hostRules: [{ hostType: 'pypi', token: 'some-token' }],
      });
    });
    it('rejects incomplete datasource env token', () => {
      const envParam: NodeJS.ProcessEnv = {
        PYPI_FOO_TOKEN: 'some-token',
      };
      expect(env.getConfig(envParam).hostRules).toHaveLength(0);
    });
    it('rejects npm env', () => {
      const envParam: NodeJS.ProcessEnv = {
        npm_package_devDependencies__types_registry_auth_token: '4.2.0',
      };
      expect(env.getConfig(envParam).hostRules).toHaveLength(0);
    });
    it('supports Bitbucket token', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_PLATFORM: PlatformId.Bitbucket,
        RENOVATE_ENDPOINT: 'a bitbucket endpoint',
        RENOVATE_USERNAME: 'some-username',
        RENOVATE_PASSWORD: 'app-password',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot({
        platform: 'bitbucket',
        endpoint: 'a bitbucket endpoint',
        username: 'some-username',
        password: 'app-password',
      });
    });
    it('supports Bitbucket username/password', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_PLATFORM: PlatformId.Bitbucket,
        RENOVATE_ENDPOINT: 'a bitbucket endpoint',
        RENOVATE_USERNAME: 'some-username',
        RENOVATE_PASSWORD: 'app-password',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot({
        endpoint: 'a bitbucket endpoint',
        hostRules: [],
        password: 'app-password',
        platform: 'bitbucket',
        username: 'some-username',
      });
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
    describe('malformed RENOVATE_CONFIG', () => {
      let processExit: jest.SpyInstance<never, [code?: number]>;

      beforeAll(() => {
        processExit = jest
          .spyOn(process, 'exit')
          .mockImplementation((() => {}) as never);
      });

      afterAll(() => {
        processExit.mockRestore();
      });

      it('crashes', () => {
        const envParam: NodeJS.ProcessEnv = { RENOVATE_CONFIG: '!@#' };
        env.getConfig(envParam);
        expect(processExit).toHaveBeenCalledWith(1);
      });
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
