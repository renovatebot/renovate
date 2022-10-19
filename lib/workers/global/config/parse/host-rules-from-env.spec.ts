import { hostRulesFromEnv } from './host-rules-from-env';

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

  it('supports datasource env token', () => {
    const envParam: NodeJS.ProcessEnv = {
      PYPI_TOKEN: 'some-token',
    };
    expect(hostRulesFromEnv(envParam)).toMatchObject([
      { hostType: 'pypi', token: 'some-token' },
    ]);
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
