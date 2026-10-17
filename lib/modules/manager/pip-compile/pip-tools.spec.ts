import { GoogleAuth as _googleAuth } from 'google-auth-library';
import { hostRules } from '~test/host-rules.ts';
import { logger, partial } from '~test/util.ts';
import { exec } from '../../../util/exec/index.ts';
import { parseUrl } from '../../../util/url.ts';
import { execPipCompile } from './pip-tools.ts';

vi.mock('google-auth-library');
vi.mock('../../../util/exec/index.ts', () => ({ exec: vi.fn() }));

describe('modules/manager/pip-compile/pip-tools', () => {
  const cmd = 'pip-compile requirements.in';
  const options = { cwd: '/repo', extraEnv: { EXISTING: 'value' } };

  it('passes credentials for multiple registries and preserves execution options', async () => {
    hostRules.add({
      hostType: 'pypi',
      matchHost: 'https://example.com/private/',
      username: 'user1',
      password: 'password1',
    });
    hostRules.add({
      matchHost: 'example2.com',
      username: 'user2',
      password: 'password2',
    });

    await execPipCompile(cmd, options, [
      parseUrl('https://example.com/private/simple')!,
      parseUrl('https://example2.com/pypi/simple')!,
    ]);

    expect(exec).toHaveBeenCalledWith(cmd, {
      ...options,
      extraEnv: {
        EXISTING: 'value',
        KEYRING_SERVICE_NAME_0: 'example.com',
        KEYRING_SERVICE_USERNAME_0: 'user1',
        KEYRING_SERVICE_PASSWORD_0: 'password1',
        KEYRING_SERVICE_NAME_1: 'example2.com',
        KEYRING_SERVICE_USERNAME_1: 'user2',
        KEYRING_SERVICE_PASSWORD_1: 'password2',
      },
    });
    expect(logger.logger.trace).toHaveBeenCalledWith(
      {
        registryCredVars: [
          'KEYRING_SERVICE_NAME_0',
          'KEYRING_SERVICE_USERNAME_0',
          'KEYRING_SERVICE_PASSWORD_0',
          'KEYRING_SERVICE_NAME_1',
          'KEYRING_SERVICE_USERNAME_1',
          'KEYRING_SERVICE_PASSWORD_1',
        ],
      },
      'pip-compile registry credentials',
    );
  });

  it.each`
    username     | password
    ${'user'}    | ${undefined}
    ${undefined} | ${'password'}
  `(
    'handles partial credentials: $username / $password',
    async ({ username, password }) => {
      hostRules.add({ matchHost: 'example.com', username, password });

      await execPipCompile(cmd, {}, [parseUrl('https://example.com/simple')!]);

      expect(exec).toHaveBeenCalledWith(cmd, {
        extraEnv: {
          KEYRING_SERVICE_NAME_0: 'example.com',
          KEYRING_SERVICE_USERNAME_0: username ?? '',
          KEYRING_SERVICE_PASSWORD_0: password ?? '',
        },
      });
    },
  );

  it.each`
    registryUrls
    ${[]}
    ${[parseUrl('https://example.com/simple')!]}
  `('runs without credentials for $registryUrls', async ({ registryUrls }) => {
    await execPipCompile(cmd, options, registryUrls);

    expect(exec).toHaveBeenCalledWith(cmd, options);
  });

  it('ignores rules scoped to another host type', async () => {
    hostRules.add({
      hostType: 'npm',
      matchHost: 'example.com',
      username: 'user',
      password: 'password',
    });

    await execPipCompile(cmd, options, [
      parseUrl('https://example.com/simple')!,
    ]);

    expect(exec).toHaveBeenCalledWith(cmd, options);
  });

  it('supports Google Artifact Registry', async () => {
    // GoogleAuth is mocked as a class and instantiated with `new`, requires regular function
    // eslint-disable-next-line prefer-arrow-callback
    vi.mocked(_googleAuth).mockImplementationOnce(function () {
      return partial<InstanceType<typeof _googleAuth>>({
        getAccessToken: vi.fn().mockResolvedValue('some-token'),
      });
    });

    await execPipCompile(cmd, options, [
      parseUrl(
        'https://someregion-python.pkg.dev/some-project/some-repo/simple',
      )!,
    ]);

    expect(exec).toHaveBeenCalledWith(cmd, {
      ...options,
      extraEnv: {
        EXISTING: 'value',
        KEYRING_SERVICE_NAME_0: 'someregion-python.pkg.dev',
        KEYRING_SERVICE_USERNAME_0: 'oauth2accesstoken',
        KEYRING_SERVICE_PASSWORD_0: 'some-token',
      },
    });
  });
});
