import { presets } from './group';

const exceptions = new Set(['monorepos', 'recommended']);

describe('config/presets/internal/group', () => {
  it('presets should have right name', () => {
    // Check that each preset contains a `packageRules` key, except exceptions
    for (const name of Object.keys(presets).filter(
      (name) => !exceptions.has(name),
    )) {
      expect(presets[name]).toHaveProperty('packageRules');
    }
  });
});
