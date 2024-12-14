import { presets } from './group';

const exceptions = new Set(['monorepos', 'recommended']);

describe('config/presets/internal/group', () => {
  const presetNames = Object.keys(presets).filter(
    (name) => !exceptions.has(name),
  );

  it.each(presetNames)('group:%s contains packageRules', (name: string) => {
    expect(presets[name]).toHaveProperty('packageRules');
  });
});
