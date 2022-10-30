import { git, mockedFunction } from '../../../test/util';
import type { AllConfig, RenovateConfig } from '../../config/types';
import { initPlatform as _initPlatform } from '../../modules/platform';
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
});
