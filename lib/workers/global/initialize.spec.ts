import { git, mockedFunction } from '../../../test/util';
import type { AllConfig, RenovateConfig } from '../../config/types';
import { initPlatform as _initPlatform } from '../../modules/platform';
import * as hostRules from '../../util/host-rules';
import { globalInitialize } from './initialize';

jest.mock('../../util/git');
const initPlatform = mockedFunction(_initPlatform);

describe('workers/global/initialize', () => {
  beforeEach(() => {
    initPlatform.mockImplementationOnce((r) => Promise.resolve(r));
  });

  describe('checkVersions()', () => {
    it('throws if invalid version', async () => {
      const config: RenovateConfig = {};
      git.validateGitVersion.mockResolvedValueOnce(false);
      await expect(globalInitialize(config)).rejects.toThrow();
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

  describe('setGlobalHostRules', () => {
    beforeEach(() => {
      hostRules.clear();
    });

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
  });
});
