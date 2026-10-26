import {
  validateContainerbaseVersion as _validateContainerbaseVersion,
  containerbaseVersionFile,
  packageVersion,
} from '@renovatebot/base-image';
import { Fixtures } from '~test/fixtures.ts';
import { git, logger } from '~test/util.ts';
import { GlobalConfig } from '../../config/global.ts';
import type { AllConfig, RenovateConfig } from '../../config/types.ts';
import { initPlatform as _initPlatform } from '../../modules/platform/index.ts';
import { setCustomEnv } from '../../util/env.ts';
import * as hostRules from '../../util/host-rules.ts';
import { globalInitialize } from './initialize.ts';

vi.mock('@renovatebot/base-image', { spy: true });
vi.mock('node:fs/promises', async () => {
  const { fs } = await vi.importActual<typeof import('memfs')>('memfs');
  return { ...fs.promises, default: fs.promises };
});

const initPlatform = vi.mocked(_initPlatform);
const validateContainerbaseVersion = vi.mocked(_validateContainerbaseVersion);

describe('workers/global/initialize', () => {
  beforeEach(() => {
    vi.stubEnv('CONTAINERBASE', undefined);
    vi.stubEnv('RENOVATE_X_IGNORE_CONTAINERBASE_VERSION', undefined);
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

  describe('checkContainerbaseVersion()', () => {
    beforeEach(() => {
      git.validateGitVersion.mockResolvedValue(true);
    });

    afterEach(() => {
      Fixtures.reset();
    });

    it('skips the check outside of containerbase', async () => {
      await expect(globalInitialize({})).toResolve();
      expect(validateContainerbaseVersion).not.toHaveBeenCalled();
    });

    it('validates the version in containerbase', async () => {
      vi.stubEnv('CONTAINERBASE', 'true');
      Fixtures.mock({ [containerbaseVersionFile]: `${packageVersion}\n` });
      await expect(globalInitialize({})).toResolve();
      expect(validateContainerbaseVersion).toHaveBeenCalledOnce();
      expect(logger.logger.debug).toHaveBeenCalledWith(
        { version: packageVersion },
        'Containerbase image version is compatible',
      );
    });

    it('throws if the version is not compatible', async () => {
      vi.stubEnv('CONTAINERBASE', 'true');
      Fixtures.mock({ [containerbaseVersionFile]: '1.0.0\n' });
      await expect(globalInitialize({})).rejects.toThrow(
        `Init: containerbase image version check failed: The containerbase image version 1.0.0 is not compatible with @containerbase/base ${packageVersion}, it needs the same major version and the same or a newer minor or patch version. Upgrade your version of Containerbase, or set \`RENOVATE_X_IGNORE_CONTAINERBASE_VERSION\` to skip the check.`,
      );
    });

    it('throws if the version file is missing', async () => {
      vi.stubEnv('CONTAINERBASE', 'true');
      await expect(globalInitialize({})).rejects.toThrow(
        `Init: containerbase image version check failed: The containerbase image version file ${containerbaseVersionFile} is missing. Upgrade your version of Containerbase, or set \`RENOVATE_X_IGNORE_CONTAINERBASE_VERSION\` to skip the check.`,
      );
    });

    it('throws if the version file is empty', async () => {
      vi.stubEnv('CONTAINERBASE', 'true');
      Fixtures.mock({ [containerbaseVersionFile]: '' });
      await expect(globalInitialize({})).rejects.toThrow(
        `Init: containerbase image version check failed: The containerbase image version file ${containerbaseVersionFile} is empty. Upgrade your version of Containerbase, or set \`RENOVATE_X_IGNORE_CONTAINERBASE_VERSION\` to skip the check.`,
      );
    });

    it('still checks the version if the bypass is only set via customEnvVariables', async () => {
      vi.stubEnv('CONTAINERBASE', 'true');
      setCustomEnv({ RENOVATE_X_IGNORE_CONTAINERBASE_VERSION: 'true' });
      Fixtures.mock({ [containerbaseVersionFile]: `${packageVersion}\n` });
      await expect(globalInitialize({})).toResolve();
      expect(validateContainerbaseVersion).toHaveBeenCalledOnce();
      setCustomEnv({});
    });

    it('skips the check if ignored', async () => {
      vi.stubEnv('CONTAINERBASE', 'true');
      vi.stubEnv('RENOVATE_X_IGNORE_CONTAINERBASE_VERSION', 'true');
      await expect(globalInitialize({})).toResolve();
      expect(validateContainerbaseVersion).not.toHaveBeenCalled();
      expect(logger.logger.info).toHaveBeenCalledWith(
        'Containerbase version check is skipped via RENOVATE_X_IGNORE_CONTAINERBASE_VERSION',
      );
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
