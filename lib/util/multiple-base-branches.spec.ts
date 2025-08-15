import {
  expectMultipleBaseBranches,
  setMultipleBaseBranches,
} from './multiple-base-branches';

describe('util/multiple-base-branches', () => {
  beforeEach(() => {
    setMultipleBaseBranches({});
  });

  it('returns true', () => {
    expect(expectMultipleBaseBranches()).toBeFalse();
    setMultipleBaseBranches({ baseBranchPatterns: ['/test/'] });
    expect(expectMultipleBaseBranches()).toBeTrue();
  });

  it('returns false', () => {
    expect(expectMultipleBaseBranches()).toBeFalse();
    setMultipleBaseBranches({ baseBranchPatterns: ['test'] });
    expect(expectMultipleBaseBranches()).toBeFalse();
  });
});
