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

  it('globs for .json and .json5 files', () => {
    const filenames = getConfigFileNames();

    expect(filenames.includes('renovate.json')).toBeTrue();
    expect(filenames.includes('renovate.json5')).toBeTrue();

    // does not include the raw pattern
    expect(filenames.includes('renovate.json{,5}')).toBeFalse();

    // but does not support this for package.json
    expect(filenames.includes('package.json5')).toBeFalse();
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
