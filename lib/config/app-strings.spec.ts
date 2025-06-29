import { getConfigFileNames, setUserConfigFileNames } from './app-strings';

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
});
