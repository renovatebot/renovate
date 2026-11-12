import fs from 'fs-extra';
import { GoogleAuth as _googleAuth } from 'google-auth-library';
import { hostRules } from '~test/host-rules.ts';
import { partial } from '~test/util.ts';
import { exec } from '../../../util/exec/index.ts';
import { ensureDir, privateCacheDir } from '../../../util/fs/index.ts';
import { parseUrl } from '../../../util/url.ts';
import { execUv } from './uv.ts';

vi.mock('google-auth-library');

vi.mock('fs-extra', () => ({
  default: {
    mkdtemp: vi.fn(() => '/cache/__renovate-private-cache/uv-random'),
    writeFile: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock('../../../util/exec/index.ts', () => ({ exec: vi.fn() }));
vi.mock('../../../util/fs/index.ts', () => ({
  ensureDir: vi.fn(),
  privateCacheDir: vi.fn(),
}));

describe('modules/manager/pip-compile/uv', () => {
  const cmd = 'uv pip compile --emit-index-url requirements.in';
  const options = { cwd: '/repo', extraEnv: { EXISTING: 'value' } };

  beforeEach(() => {
    vi.mocked(privateCacheDir).mockReturnValue(
      '/cache/__renovate-private-cache',
    );
  });

  it.each`
    registryUrls
    ${[]}
    ${[parseUrl('https://example.com/simple')!]}
  `(
    'does not create a netrc without credentials: $registryUrls',
    async ({ registryUrls }) => {
      await execUv(cmd, options, registryUrls);

      expect(exec).toHaveBeenCalledWith(cmd, options);
      expect(fs.mkdtemp).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    },
  );

  it('uses PyPI and unscoped host rules for registry URLs', async () => {
    hostRules.add({
      hostType: 'npm',
      matchHost: 'example.com',
      password: 'wrong',
    });
    hostRules.add({
      hostType: 'pypi',
      matchHost: 'https://example.com/private/',
      username: 'user',
      password: 'secret',
    });
    hostRules.add({
      matchHost: 'other.example.com',
      username: 'other',
      password: 'other-secret',
    });

    await execUv(cmd, options, [
      parseUrl('https://example.com/private/simple')!,
      parseUrl('https://other.example.com/simple')!,
      parseUrl('https://example.com/private/simple')!,
    ]);

    expect(ensureDir).toHaveBeenCalledWith('/cache/__renovate-private-cache');
    expect(fs.mkdtemp).toHaveBeenCalledWith(
      '/cache/__renovate-private-cache/uv-',
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      '/cache/__renovate-private-cache/uv-random/.netrc',
      'machine "example.com" login "user" password "secret"\nmachine "other.example.com" login "other" password "other-secret"\n',
      { mode: 0o600 },
    );
    expect(exec).toHaveBeenCalledWith(cmd, {
      ...options,
      extraEnv: {
        EXISTING: 'value',
        NETRC: '/cache/__renovate-private-cache/uv-random/.netrc',
      },
    });
    expect(fs.remove).toHaveBeenCalledWith(
      '/cache/__renovate-private-cache/uv-random',
    );
  });

  it('supports Google Artifact Registry credentials', async () => {
    // GoogleAuth is mocked as a class and instantiated with `new`, requires regular function
    // eslint-disable-next-line prefer-arrow-callback
    vi.mocked(_googleAuth).mockImplementationOnce(function () {
      return partial<InstanceType<typeof _googleAuth>>({
        getAccessToken: vi.fn().mockResolvedValue('some-token'),
      });
    });

    await execUv(cmd, options, [
      parseUrl(
        'https://someregion-python.pkg.dev/some-project/some-repo/simple',
      )!,
    ]);

    expect(fs.writeFile).toHaveBeenCalledWith(
      '/cache/__renovate-private-cache/uv-random/.netrc',
      'machine "someregion-python.pkg.dev" login "oauth2accesstoken" password "some-token"\n',
      { mode: 0o600 },
    );
  });

  it.each`
    username       | password     | expected
    ${'user'}      | ${undefined} | ${'login "user" password ""'}
    ${undefined}   | ${'secret'}  | ${'login "" password "secret"'}
    ${'two words'} | ${'a"b\\c'}  | ${'login "two words" password "a\\"b\\\\c"'}
  `(
    'quotes credentials: $expected',
    async ({ username, password, expected }) => {
      hostRules.add({ matchHost: 'example.com', username, password });

      await execUv(cmd, {}, [parseUrl('https://example.com/simple')!]);

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/cache/__renovate-private-cache/uv-random/.netrc',
        `machine "example.com" ${expected}\n`,
        { mode: 0o600 },
      );
    },
  );

  it.each(['write', 'exec'])(
    'removes credentials after a %s failure',
    async (failure) => {
      hostRules.add({
        matchHost: 'example.com',
        username: 'user',
        password: 'secret',
      });
      const error = new Error('failed');
      if (failure === 'write') {
        vi.mocked(fs.writeFile).mockRejectedValueOnce(error);
      } else {
        vi.mocked(exec).mockRejectedValueOnce(error);
      }

      await expect(
        execUv(cmd, options, [parseUrl('https://example.com/simple')!]),
      ).rejects.toThrow(error);

      expect(fs.remove).toHaveBeenCalledWith(
        '/cache/__renovate-private-cache/uv-random',
      );
    },
  );
});
