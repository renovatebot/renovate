import { defaultConfig } from '.';

describe('modules/manager/pip_requirements/index', () => {
  it('default config file pattern', () => {
    const reg = new RegExp(defaultConfig.fileMatch[0]);

    expect(reg.test('requirements.txt')).toBe(true);
    expect(reg.test('requirements-dev.txt')).toBe(true);
    expect(reg.test('requirements.dev.txt')).toBe(true);
    expect(reg.test('requirements-dev.pip')).toBe(true);
    expect(reg.test('requirements.dev.pip')).toBe(true);
  });
});
