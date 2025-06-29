import { getConfigFileNames, setUserConfigFileNames } from './app-strings';

describe('config/app-strings', () => {
  it('adds user configured filenames to list', () => {
    setUserConfigFileNames(['abc', 'def']);
    const filenames = getConfigFileNames();
    expect(filenames.includes('abc')).toBeTrue();
    expect(filenames.includes('def')).toBeTrue();
  });
});
