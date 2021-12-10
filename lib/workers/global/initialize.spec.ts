import { git } from '../../../test/util';
import type { RenovateConfig } from '../../config/types';
import { globalInitialize } from './initialize';

jest.mock('../../util/git');

describe('workers/global/initialize', () => {
  describe('checkVersions()', () => {
    it('throws if invalid version', async () => {
      const config: RenovateConfig = {};
      git.validateGitVersion.mockResolvedValueOnce(false);
      await expect(globalInitialize(config)).rejects.toThrow();
    });

    it('returns if valid git version', async () => {
      const config: RenovateConfig = {};
      git.validateGitVersion.mockResolvedValueOnce(true);
      await expect(globalInitialize(config)).toResolve();
    });
  });
});
