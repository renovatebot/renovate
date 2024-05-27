import { check } from './match-base-branches';

describe('config/validation-helpers/match-base-branches', () => {
  it('returns error when baseBranches is not defined', () => {
    const res = check({
      resolvedRule: { matchBaseBranches: ['develop'], addLabels: ['develop'] },
      currentPath: 'packageRules',
      index: 0,
      defaultBranch: 'main',
    });
    expect(res).toEqual({
      errors: [
        {
          topic: 'Configuration Error',
          message:
            'packageRules[0]: You must configure baseBranches inorder to use them inside matchBaseBranches.clear',
        },
      ],
      warnings: [],
    });
  });

  it('returns warning when matchBaseBranches has the default branch', () => {
    const res = check({
      resolvedRule: { matchBaseBranches: ['main'], addLabels: ['main'] },
      currentPath: 'packageRules',
      index: 0,
      defaultBranch: 'main',
      baseBranches: ['main'],
    });
    expect(res).toEqual({
      errors: [],
      warnings: [
        {
          topic: 'Configuration Error',
          message:
            'packageRules[0]: You have only included the default branch inside matchBaseBranches. It seems like a misunderstanding as this is already the default behaviour.',
        },
      ],
    });
  });

  it('returns empty arrays for valid configuration', () => {
    const res = check({
      resolvedRule: { matchBaseBranches: ['develop'], addLabels: ['develop'] },
      currentPath: 'packageRules',
      index: 0,
      defaultBranch: 'main',
      baseBranches: ['develop', 'main'],
    });
    expect(res).toEqual({
      errors: [],
      warnings: [],
    });
  });
});
