import { addConfigFileNames, getConfigFileNames } from './app-strings';
import { GlobalConfig } from './global';

describe('config/app-strings', () => {
  beforeEach(() => {
    GlobalConfig.set({ platform: 'github' });
  });

  it('returns platform specific config filenames', () => {
    const filenames = getConfigFileNames();
    expect(filenames.includes('.gitlab/renovate.json')).toBeFalse();
    expect(filenames.includes('.github/renovate.json')).toBeTrue();
  });

  it('adds user configured filenames to list', () => {
    addConfigFileNames(['abc', 'def']);
    const filenames = getConfigFileNames();
    expect(filenames.includes('abc')).toBeTrue();
    expect(filenames.includes('def')).toBeTrue();
  });
});
