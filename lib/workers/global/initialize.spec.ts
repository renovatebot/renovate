import { mocked } from '../../../test/util';
import { RenovateConfig } from '../../config/types';
import * as _git from '../../util/git';
import { globalInitialize } from './initialize';

jest.mock('../../util/git');

const git = mocked(_git);

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
