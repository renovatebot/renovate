import { mocked } from '../../../test/util';
import * as _git from '../../util/git';
import { checkVersions } from './initialize';

jest.mock('../../util/git');

const git = mocked(_git);

describe('workers/global/initialize', () => {
  describe('checkVersions()', () => {
    it('throws if invalid version', async () => {
      git.validateGitVersion.mockResolvedValueOnce(false);
      await expect(checkVersions()).rejects.toThrow();
    });

    it('returns if valid git version', async () => {
      git.validateGitVersion.mockResolvedValueOnce(true);
      await expect(checkVersions()).toResolve();
    });
  });
});
