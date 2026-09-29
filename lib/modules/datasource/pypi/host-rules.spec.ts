import { GoogleAuth as _googleAuth } from 'google-auth-library';
import { hostRules, logger, partial } from '~test/util.ts';
import { findPypiIndexCredentials } from './host-rules.ts';

vi.mock('google-auth-library');

const googleAuth = vi.mocked(_googleAuth);

function mockGoogleAccessToken(token: string | undefined): void {
  // GoogleAuth is mocked as a class and instantiated with `new`, requires regular function
  // eslint-disable-next-line prefer-arrow-callback
  googleAuth.mockImplementationOnce(function () {
    return partial<InstanceType<typeof _googleAuth>>({
      getAccessToken: vi.fn().mockResolvedValue(token),
    });
  });
}

describe('modules/datasource/pypi/host-rules', () => {
  beforeEach(() => {
    hostRules.clear();
  });

  it('returns no credentials for an unparseable URL', async () => {
    await expect(findPypiIndexCredentials('not-a-url')).resolves.toEqual({});
    expect(logger.logger.once.debug).toHaveBeenCalledWith(
      'Failed to parse index URL not-a-url',
    );
  });

  it('returns no credentials when no host rule matches', async () => {
    await expect(
      findPypiIndexCredentials('https://example.com/simple/'),
    ).resolves.toEqual({});
  });

  it('matches a rule scoped to the pypi hostType', async () => {
    hostRules.add({
      hostType: 'pypi',
      matchHost: 'example.com',
      username: 'user',
      password: 'pass',
    });

    await expect(
      findPypiIndexCredentials('https://example.com/simple/'),
    ).resolves.toEqual({ username: 'user', password: 'pass' });
  });

  it('ignores a rule scoped to another hostType', async () => {
    hostRules.add({
      hostType: 'npm',
      matchHost: 'example.com',
      username: 'user',
      password: 'pass',
    });

    await expect(
      findPypiIndexCredentials('https://example.com/simple/'),
    ).resolves.toEqual({});
  });

  it('strips credentials from the URL before matching', async () => {
    hostRules.add({
      matchHost: 'https://example.com/simple/',
      username: 'user',
      password: 'pass',
    });

    await expect(
      findPypiIndexCredentials('https://${USER}:${PASS}@example.com/simple/'),
    ).resolves.toEqual({ username: 'user', password: 'pass' });
  });

  it('falls back to Google Artifact Registry', async () => {
    mockGoogleAccessToken('some-token');

    await expect(
      findPypiIndexCredentials(
        'https://someregion-python.pkg.dev/some-project/some-repo/simple/',
      ),
    ).resolves.toEqual({
      username: 'oauth2accesstoken',
      password: 'some-token',
    });
  });

  it('logs when no Google access token is available', async () => {
    mockGoogleAccessToken(undefined);

    await expect(
      findPypiIndexCredentials(
        'https://someregion-python.pkg.dev/some-project/some-repo/simple/',
      ),
    ).resolves.toEqual({});
    expect(logger.logger.once.debug).toHaveBeenCalledWith(
      'Could not get Google access token (url=https://someregion-python.pkg.dev/some-project/some-repo/simple/)',
    );
  });

  it('prefers host rule credentials over Google Artifact Registry', async () => {
    hostRules.add({
      matchHost: 'pkg.dev',
      username: 'user',
      password: 'pass',
    });

    await expect(
      findPypiIndexCredentials(
        'https://someregion-python.pkg.dev/some-project/some-repo/simple/',
      ),
    ).resolves.toEqual({ username: 'user', password: 'pass' });
    expect(googleAuth).not.toHaveBeenCalled();
  });

  it('falls back to Google Artifact Registry when the rule has no credentials', async () => {
    hostRules.add({
      matchHost: 'pkg.dev',
      token: 'unused-by-pypi',
    });
    mockGoogleAccessToken('some-token');

    await expect(
      findPypiIndexCredentials(
        'https://someregion-python.pkg.dev/some-project/some-repo/simple/',
      ),
    ).resolves.toEqual({
      username: 'oauth2accesstoken',
      password: 'some-token',
    });
  });
});
