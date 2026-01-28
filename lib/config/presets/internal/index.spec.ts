import { CONFIG_VALIDATION } from '../../../constants/error-messages.ts';
import { regEx } from '../../../util/regex.ts';
import { massageConfig } from '../../massage.ts';
import { validateConfig } from '../../validation.ts';
import { resolveConfigPresets } from '..//index.ts';
import * as npm from '../npm/index.ts';
import * as internal from './index.ts';

vi.mock('../npm/index.ts');
vi.mock('../../../modules/datasource/npm/index.ts');

const getPresetSpy = vi.spyOn(npm, 'getPreset');

const ignoredPresets = ['default:group', 'default:timezone'];

describe('config/presets/internal/index', () => {
  beforeEach(() => {
    getPresetSpy.mockResolvedValue(undefined);
  });

  it('fails for undefined internal preset', async () => {
    const preset = 'foo:bar';
    const presetConfig = { extends: [preset] };
    await expect(resolveConfigPresets(presetConfig)).rejects.toThrow(
      CONFIG_VALIDATION,
    );
  });

  const presetsToTest = Object.entries(internal.groups).flatMap(
    ([groupName, groupPresets]) =>
      Object.entries(groupPresets)
        .filter(
          ([presetName]) =>
            presetName !== 'description' &&
            !ignoredPresets.includes(`${groupName}:${presetName}`),
        )
        .map(([presetName, presetConfig]) => ({
          groupName,
          preset: `${groupName}:${presetName}`,
          presetConfig,
        })),
  );

  for (const { groupName, preset, presetConfig } of presetsToTest) {
    it(`${preset} validates`, async () => {
      try {
        const { config } = await resolveConfigPresets(
          massageConfig(presetConfig),
        );
        const configType = groupName === 'global' ? 'global' : 'repo';
        const res = await validateConfig(configType, config, true);
        expect(res.errors).toHaveLength(0);
        expect(res.warnings).toHaveLength(0);
      } catch (err) {
        if (err.validationError) {
          throw new Error(err.validationError);
        }
        throw err;
      }
    });
  }

  it('internal presets should not contain handlebars', () => {
    Object.entries(internal.groups)
      .map(([groupName, groupPresets]) =>
        Object.entries(groupPresets).map(
          ([presetName]) => `${groupName}:${presetName}`,
        ),
      )
      .flat()
      .forEach((preset) => expect(preset).not.toMatch(regEx(/{{.*}}/)));
  });

  it('returns undefined for unknown preset', () => {
    expect(internal.getPreset({ repo: 'some/repo' })).toBeUndefined();
  });

  describe('isInternal', () => {
    it('returns false for a local> preset', () => {
      expect(internal.isInternal('local>renovatebot/.github')).toBeFalse();
    });

    it('returns false for a github> preset', () => {
      expect(internal.isInternal('github>renovatebot/.github')).toBeFalse();
    });

    it('returns false for an un-migrated preset', () => {
      expect(internal.isInternal('config:base')).toBeFalse();
    });

    it('returns false for an empty string', () => {
      expect(internal.isInternal('')).toBeFalse();
    });

    it('returns true for `config:recommended`', () => {
      expect(internal.isInternal('config:recommended')).toBeTrue();
    });

    it('returns true for a parameterised preset', () => {
      expect(internal.isInternal(':assignee(renovate-tests)')).toBeTrue();
    });

    it('returns true for a parameterised remote preset', () => {
      expect(
        internal.isInternal(
          'local>example/renovate-config-presets:assignee(renovate-tests)',
        ),
      ).toBeFalse();
    });
  });
});
