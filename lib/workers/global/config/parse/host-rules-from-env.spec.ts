import { hostRulesFromEnv } from './host-rules-from-env';
import { logger } from '~test/util';

describe('workers/global/config/parse/host-rules-from-env', () => {
  it('supports docker username/password', () => {
    const envParam: NodeJS.ProcessEnv = {
      DOCKER_USERNAME: 'some-username',
      DOCKER_PASSWORD: 'some-password',
    };
    expect(hostRulesFromEnv(envParam)).toMatchObject([
      {
        hostType: 'docker',
        password: 'some-password',
        username: 'some-username',
      },
    ]);
  });

  it('supports password-only', () => {
    const envParam: NodeJS.ProcessEnv = {
      NPM_PASSWORD: 'some-password',
    };
    expect(hostRulesFromEnv(envParam)).toMatchObject([
      { hostType: 'npm', password: 'some-password' },
    ]);
  });

  it('supports domain and host names with case insensitivity', () => {
    const envParam: NodeJS.ProcessEnv = {
      GITHUB__TAGS_GITHUB_COM_TOKEN: 'some-token',
      pypi_my_CUSTOM_HOST_passWORD: 'some-password',
    };

    expect(hostRulesFromEnv(envParam)).toMatchObject([
      { matchHost: 'github.com', token: 'some-token' },
      { matchHost: 'my.custom.host', password: 'some-password' },
    ]);
  });

  it('regression test for #10937', () => {
    const envParam: NodeJS.ProcessEnv = {
      GIT__TAGS_GITLAB_EXAMPLE__DOMAIN_NET_USERNAME: 'some-user',
      GIT__TAGS_GITLAB_EXAMPLE__DOMAIN_NET_PASSWORD: 'some-password',
    };
    expect(hostRulesFromEnv(envParam)).toMatchObject([
      {
        hostType: 'git-tags',
        matchHost: 'gitlab.example-domain.net',
        password: 'some-password',
        username: 'some-user',
      },
    ]);
  });

  it('support RENOVATE_ prefixed host rules', () => {
    const envParam: NodeJS.ProcessEnv = {
      RENOVATE_GITHUB__TAGS_GITHUB_COM_TOKEN: 'some-token',
    };

    expect(hostRulesFromEnv(envParam)).toMatchObject([
      { matchHost: 'github.com', token: 'some-token' },
    ]);
  });

  it('supports renovate in the env variable', () => {
    const envParam: NodeJS.ProcessEnv = {
      PYPI_MY_RENOVATE_HOST_PASSWORD: 'some-password',
      RENOVATE_DOCKER_MY_RENOVATE_HOST_PASSWORD: 'docker-password',
    };

    expect(hostRulesFromEnv(envParam)).toMatchObject([
      { matchHost: 'my.renovate.host', password: 'some-password' },
      { matchHost: 'my.renovate.host', password: 'docker-password' },
    ]);
  });

  it('support https authentication options', () => {
    const envParam: NodeJS.ProcessEnv = {
      GITHUB_SOME_GITHUB__ENTERPRISE_HOST_HTTPSPRIVATEKEY: 'private-key',
      GITHUB_SOME_GITHUB__ENTERPRISE_HOST_HTTPSCERTIFICATE: 'certificate',
      GITHUB_SOME_GITHUB__ENTERPRISE_HOST_HTTPSCERTIFICATEAUTHORITY:
        'certificate-authority',
    };
    expect(hostRulesFromEnv(envParam)).toMatchObject([
      {
        hostType: 'github',
        matchHost: 'some.github-enterprise.host',
        httpsPrivateKey: 'private-key',
        httpsCertificate: 'certificate',
        httpsCertificateAuthority: 'certificate-authority',
      },
    ]);
  });

  it('make sure {{PLATFORM}}_TOKEN will not be picked up', () => {
    const unsupportedEnv = ['GITHUB_TOKEN'];

    for (const e of unsupportedEnv) {
      const envParam: NodeJS.ProcessEnv = {
        [e]: 'private-key',
      };
      expect(hostRulesFromEnv(envParam)).toMatchObject([]);
    }
  });

  it('supports datasource env token', () => {
    const envParam: NodeJS.ProcessEnv = {
      PYPI_TOKEN: 'some-token',
    };
    expect(hostRulesFromEnv(envParam)).toMatchObject([
      { hostType: 'pypi', token: 'some-token' },
    ]);
  });

  it('supports platform env token', () => {
    const envParam: NodeJS.ProcessEnv = {
      GITHUB_COM_TOKEN: 'this-should-be-ignored-here',
      GITHUB_SOME_GITHUB__ENTERPRISE_HOST_TOKEN: 'some-token',
    };
    expect(hostRulesFromEnv(envParam)).toMatchObject([
      {
        hostType: 'github',
        matchHost: 'some.github-enterprise.host',
        token: 'some-token',
      },
    ]);
    expect(logger.logger.warn).not.toHaveBeenCalled();
  });

  it('rejects incomplete datasource env token', () => {
    const envParam: NodeJS.ProcessEnv = {
      PYPI_FOO_TOKEN: 'some-token',
    };
    expect(hostRulesFromEnv(envParam)).toHaveLength(0);
  });

  it('rejects npm env', () => {
    const envParam: NodeJS.ProcessEnv = {
      npm_package_devDependencies__types_registry_auth_token: '4.2.0',
    };
    expect(hostRulesFromEnv(envParam)).toHaveLength(0);
  });
});
