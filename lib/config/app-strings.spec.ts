import { getConfigFileNames, setUserConfigFileNames } from './app-strings.ts';

describe('config/app-strings', () => {
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
});
