import { presets } from './replacements.preset.ts';

describe('config/presets/internal/replacements.preset', () => {
  it('replacements:all extends every other replacements preset', () => {
    const expected = Object.keys(presets)
      .filter((name) => name !== 'all')
      .sort()
      .map((name) => `replacements:${name}`);

    expect(presets.all.extends).toEqual(expected);
    expect(presets.all.extends).toContain('replacements:material-ui-to-mui');
    expect(presets.all.extends).toContain(
      'replacements:clang-format-to-maintenance-fork',
    );
  });
});
