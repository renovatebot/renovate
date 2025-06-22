import { addConfigFileNames, getConfigFileNames } from './app-strings';
import { GlobalConfig } from './global';

describe('config/app-strings', () => {
  beforeEach(() => {
    GlobalConfig.reset();
  });

  it('returns platform specific config filenames if platform detected', () => {
    GlobalConfig.set({ platform: 'github' });
    const filenames = getConfigFileNames();
    expect(filenames.includes('.gitlab/renovate.json')).toBeFalse();
    expect(filenames.includes('.github/renovate.json')).toBeTrue();
  });

  it('returns all config filenames if platform not detected', () => {
    const filenames = getConfigFileNames();
    expect(filenames.includes('.gitlab/renovate.json')).toBeTrue();
    expect(filenames.includes('.github/renovate.json')).toBeTrue();
  });

  it('adds user configured filenames to list', () => {
    addConfigFileNames(['abc', 'def']);
    const filenames = getConfigFileNames();
    expect(filenames.includes('abc')).toBeTrue();
    expect(filenames.includes('def')).toBeTrue();
  });
});
