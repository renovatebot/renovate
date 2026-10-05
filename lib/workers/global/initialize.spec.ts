import { git, logger } from '~test/util.ts';
import { GlobalConfig } from '../../config/global.ts';
import type { AllConfig, RenovateConfig } from '../../config/types.ts';
import { initPlatform as _initPlatform } from '../../modules/platform/index.ts';
import * as hostRules from '../../util/host-rules.ts';
import { globalInitialize } from './initialize.ts';

const initPlatform = vi.mocked(_initPlatform);

describe('workers/global/initialize', () => {
  beforeEach(() => {
    initPlatform.mockImplementationOnce((r) => Promise.resolve(r));
  });

  describe('checkVersions()', () => {
    it('throws if invalid version', async () => {
      const config: RenovateConfig = {};
      git.validateGitVersion.mockResolvedValueOnce(false);
      await expect(globalInitialize(config)).rejects.toThrow(
        'Init: git version needs upgrading',
      );
    });

    it('returns if valid git version', async () => {
      const config: RenovateConfig = { prCommitsPerRunLimit: 2 };
      git.validateGitVersion.mockResolvedValueOnce(true);
      await expect(globalInitialize(config)).toResolve();
    });

    it.each`
      gitLfs       | version    | minimum    | found
      ${'upload'}  | ${null}    | ${'3.2.0'} | ${'none'}
      ${'enabled'} | ${'3.6.0'} | ${'3.7.1'} | ${'3.6.0'}
    `(
      'throws if git-lfs is not valid for gitLfs=$gitLfs',
      async ({ gitLfs, version, minimum, found }) => {
        const config: AllConfig = { gitLfs };
        git.validateGitVersion.mockResolvedValueOnce(true);
        git.validateGitLfs.mockResolvedValueOnce({ ok: false, version });

        await expect(globalInitialize(config)).rejects.toThrow(
          `Init: gitLfs="${gitLfs}" requires git-lfs >= ${minimum} on PATH (found: ${found})`,
        );
        expect(git.validateGitLfs).toHaveBeenCalledExactlyOnceWith(gitLfs);
      },
    );

    it('returns if git-lfs is valid', async () => {
      const config: AllConfig = { gitLfs: 'upload' };
      git.validateGitVersion.mockResolvedValueOnce(true);
      git.validateGitLfs.mockResolvedValueOnce({ ok: true, version: '3.8.0' });

      await expect(globalInitialize(config)).toResolve();
    });

    it.each`
      gitLfs
      ${'disabled'}
      ${'true'}
    `('does not check git-lfs when gitLfs is $gitLfs', async ({ gitLfs }) => {
      const config: AllConfig = { gitLfs };
      git.validateGitVersion.mockResolvedValueOnce(true);

      await expect(globalInitialize(config)).toResolve();
      expect(git.validateGitLfs).not.toHaveBeenCalled();
    });

    it('supports containerbase', async () => {
      const config: AllConfig = { binarySource: 'docker' };
      git.validateGitVersion.mockResolvedValueOnce(true);
      await expect(globalInitialize(config)).toResolve();
    });

    it('supports containerbase cache dir', async () => {
      const config: AllConfig = {
        binarySource: 'docker',
        containerbaseDir: '/tmp/containerbase',
      };
      git.validateGitVersion.mockResolvedValueOnce(true);
      await expect(globalInitialize(config)).toResolve();
    });
  });

  describe('setGlobalHostRules', () => {
    it('should have run before initPlatform', async () => {
      const hostRule = {
        hostType: 'github',
        matchHost: 'https://some.github-enterprise.host',
        httpsPrivateKey: 'private-key',
        httpsCertificate: 'certificate',
        httpsCertificateAuthority: 'certificate-authority',
      };

      initPlatform.mockReset();
      initPlatform.mockImplementationOnce((r) => {
        const foundRule = hostRules.find({
          hostType: hostRule.hostType,
          url: hostRule.matchHost,
        });

        expect(foundRule.httpsPrivateKey).toEqual(hostRule.httpsPrivateKey);
        expect(foundRule.httpsCertificateAuthority).toEqual(
          hostRule.httpsCertificateAuthority,
        );
        expect(foundRule.httpsCertificate).toEqual(hostRule.httpsCertificate);

        return Promise.resolve(r);
      });

      const config: RenovateConfig = {
        hostRules: [hostRule],
      };

      git.validateGitVersion.mockResolvedValueOnce(true);
      await expect(globalInitialize(config)).toResolve();
    });

    it("does not filter the self-hosted admin's own hostRules headers against allowedHeaders", async () => {
      // `allowedHeaders` constrains what a repository or preset may set, not the self-hosted administrator
      GlobalConfig.set({ allowedHeaders: ['X-*'] });
      const config: RenovateConfig = {
        hostRules: [
          {
            matchHost: 'registry.example.com',
            headers: { 'X-Allowed': 'yes', Authorization: 'from-admin' },
          },
        ],
      };

      git.validateGitVersion.mockResolvedValueOnce(true);
      await expect(globalInitialize(config)).toResolve();

      expect(hostRules.find({ url: 'https://registry.example.com' })).toEqual({
        headers: { 'X-Allowed': 'yes', Authorization: 'from-admin' },
        internalHostGrant: { implicit: true },
        trustedHeaderNames: ['X-Allowed', 'Authorization'],
      });
      const denialWarnings = logger.logger.warn.mock.calls.filter(
        ([, message]) =>
          message ===
          "Ignoring hostRules headers not permitted by this Renovate instance's `allowedHeaders`",
      );
      expect(denialWarnings).toHaveLength(0);
    });
  });

  describe('configureThirdPartyLibraries()', () => {
    beforeEach(() => {
      vi.stubEnv('AWS_EC2_METADATA_DISABLED', undefined);
      vi.stubEnv('METADATA_SERVER_DETECTION', undefined);
    });

    it('sets env vars when cloud metadata services disabled', async () => {
      const config: RenovateConfig = { useCloudMetadataServices: false };
      git.validateGitVersion.mockResolvedValueOnce(true);
      await expect(globalInitialize(config)).toResolve();
      expect(process.env.AWS_EC2_METADATA_DISABLED).toBe('true');
      expect(process.env.METADATA_SERVER_DETECTION).toBe('none');
    });

    it('does not set env vars when cloud metadata services enabled', async () => {
      const config: RenovateConfig = { useCloudMetadataServices: true };
      git.validateGitVersion.mockResolvedValueOnce(true);
      await expect(globalInitialize(config)).toResolve();
      expect(process.env.AWS_EC2_METADATA_DISABLED).toBeUndefined();
      expect(process.env.METADATA_SERVER_DETECTION).toBeUndefined();
    });
  });
});
