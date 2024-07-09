import { resolveAlias } from './utils';

describe('modules/manager/mix/utils', () => {
  it('returns the alias if package is a repo', () => {
    expect(
      resolveAlias('repo:oban', {
        oban: 'https://getoban.pro/repo',
      }),
    ).toBe('https://getoban.pro/repo');
  });

  it('returns the package if package is not a repo', () => {
    expect(
      resolveAlias('oban', {
        oban: 'https://getoban.pro/repo',
      }),
    ).toBe('oban');
  });

  it('returns the null if package is a repo but not in aliases', () => {
    expect(resolveAlias('repo:oban', {})).toBeNull();
  });
});
