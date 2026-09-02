import { presets } from './group.preset.ts';

const exceptions = new Set(['monorepos', 'recommended']);

describe('config/presets/internal/group', () => {
  const presetNames = Object.keys(presets).filter(
    (name) => !exceptions.has(name),
  );

  it.each(presetNames)('group:%s contains packageRules', (name: string) => {
    expect(presets[name]).toHaveProperty('packageRules');
  });

  it('enables Vite+ version reconciliation for the Vite+ group', () => {
    expect(presets.vitePlus).toMatchObject({
      packageRules: [
        {
          postUpdateOptions: ['vitePlusSyncVersions'],
        },
      ],
    });
  });
});
