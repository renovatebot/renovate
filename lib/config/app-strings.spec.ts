import { getConfigFileNames, setUserConfigFileNames } from './app-strings.ts';

describe('config/app-strings', () => {
  beforeEach(() => {
    setUserConfigFileNames([]);
  });

  it('adds user configured filenames to list', () => {
    let filenames = getConfigFileNames();
    expect(filenames.includes('abc')).toBeFalse();
    expect(filenames.includes('def')).toBeFalse();

    setUserConfigFileNames(['abc', 'def']);

    filenames = getConfigFileNames();
    expect(filenames.includes('abc')).toBeTrue();
    expect(filenames.includes('def')).toBeTrue();
  });

  it('filters based on platform', () => {
    const filenames = getConfigFileNames('gitea');
    expect(filenames.includes('.github/renovate.json')).toBeFalse();
    expect(filenames.includes('.gitea/renovate.json')).toBeTrue();
    expect(
      getConfigFileNames('github').includes('.github/renovate.json'),
    ).toBeTrue();
  });

  it('does not allow the local platform to have an associated filename', () => {
    const filenames = getConfigFileNames('local');

    expect(filenames.includes('.local/renovate.json')).toBeFalse();
    expect(filenames).toEqual([
      'renovate.json',
      'renovate.json5',
      '.renovaterc',
      '.renovaterc.json',
      '.renovaterc.json5',
      'package.json',
    ]);
  });
});
