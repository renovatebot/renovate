import { mockedFunction } from '../../../../../test/util';
import { getPlatformList as _getPlatformList } from '../../../../modules/platform';
import { hostRulesFromEnv } from './host-rules-from-env';

const getPlatformList = mockedFunction(_getPlatformList);

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

  it('support https authentication options', () => {
    getPlatformList.mockReturnValue(['github']);
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
    const unsupportedEnv = ['BITBUCKET_TOKEN', 'GITHUB_TOKEN', 'GITLAB_TOKEN'];

    getPlatformList.mockReturnValue(['github', 'bitbucket', 'gitlab']);

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
    getPlatformList.mockReturnValue(['github']);
    const envParam: NodeJS.ProcessEnv = {
      GITHUB_SOME_GITHUB__ENTERPRISE_HOST_TOKEN: 'some-token',
    };
    expect(hostRulesFromEnv(envParam)).toMatchObject([
      {
        hostType: 'github',
        matchHost: 'some.github-enterprise.host',
        token: 'some-token',
      },
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
