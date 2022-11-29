import { git } from '../../../test/util';
import { platformScmImpls, scm, setPlatformScmApi } from './scm';

jest.mock('../../util/git');

describe('modules/platform/scm', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('use util/git module as default implementation for each platform', async () => {
    git.isBranchBehindBase.mockResolvedValueOnce(true);
    platformScmImpls.clear();
    setPlatformScmApi('testGit');
    await scm.isBranchBehindBase('abc', 'main');
    expect(git.isBranchBehindBase).toHaveBeenCalledTimes(1);
  });

  it('call overridden function', async () => {
    const isBranchBehind = jest.fn();
    platformScmImpls.set('testGit', { isBranchBehindBase: isBranchBehind });
    setPlatformScmApi('testGit');
    await scm.isBranchBehindBase('abc', 'main');
    expect(isBranchBehind).toHaveBeenCalledTimes(1);
  });

  it('fallback to default function', async () => {
    git.isBranchBehindBase.mockResolvedValueOnce(true);
    platformScmImpls.set('testGit', {});
    setPlatformScmApi('testGit');
    await scm.isBranchBehindBase('abc', 'main');
    expect(git.isBranchBehindBase).toHaveBeenCalledTimes(1);
  });
});
