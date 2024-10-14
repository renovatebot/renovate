import { check } from './match-base-branches';

describe('config/validation-helpers/match-base-branches', () => {
  it('returns error when baseBranches is not defined', () => {
    const res = check({
      resolvedRule: { matchBaseBranches: ['develop'], addLabels: ['develop'] },
      currentPath: 'packageRules[0]',
    });
    expect(res).toEqual([
      {
        topic: 'Configuration Error',
        message:
          'packageRules[0]: You must configure baseBranches inorder to use them inside matchBaseBranches.',
      },
    ]);
  });

  it('returns empty array for valid configuration', () => {
    const res = check({
      resolvedRule: { matchBaseBranches: ['develop'], addLabels: ['develop'] },
      currentPath: 'packageRules[0]',
      baseBranches: ['develop', 'main'],
    });
    expect(res).toBeEmptyArray();
  });
});
