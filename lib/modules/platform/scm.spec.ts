import { git } from '../../../test/util';
import type { PlatformId } from '../../constants';
import { PLATFORM_NOT_FOUND } from '../../constants/error-messages';
import { scm, setPlatformScmApi } from './scm';

jest.mock('../../util/git');
jest.unmock('./scm'); //mocked from test/setup

describe('modules/platform/scm', () => {
  it('no platform chosen', () => {
    expect(() => scm.branchExists('branchName')).toThrow(PLATFORM_NOT_FOUND);
  });

  it('unknown platform', () => {
    expect(() => setPlatformScmApi('unknown' as PlatformId)).toThrow(
      PLATFORM_NOT_FOUND,
    );
  });

  it.each([
    'azure',
    'github',
    'codecommit',
    'bitbucket',
    'bitbucket-server',
    'gitea',
    'github',
    'gitlab',
  ] as PlatformId[])(
    'use util/git module as default implementation for platform %s',
    async (platform: PlatformId) => {
      git.isBranchBehindBase.mockResolvedValueOnce(true);
      setPlatformScmApi(platform);
      await scm.isBranchBehindBase('abc', 'main');
      expect(git.isBranchBehindBase).toHaveBeenCalledTimes(1);
    },
  );
});
