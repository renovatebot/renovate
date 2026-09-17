import { CONFIG_VALIDATION } from '../../../constants/error-messages.ts';
import { regEx } from '../../../util/regex.ts';
import type { RenovateConfig } from '../../types.ts';
import { validateConfig } from '../../validation.ts';
import { resolveConfigPresets } from '../index.ts';
import * as npm from '../npm/index.ts';
import * as internal from './index.ts';

vi.mock('../npm/index.ts');
vi.mock('../../../modules/datasource/npm/index.ts');

const getPresetSpy = vi.spyOn(npm, 'getPreset');

const ignoredPresets = ['default:group', 'default:timezone'];

// `packages:` and `monorepo:` presets are `packageRules` fragments made of selectors only.
// They are consumed via `packageRules[].extends` (as the `group:` presets do), so they are validated there, next to the option a real rule carries.
const packageRuleFragmentGroups = ['monorepo', 'packages'];

// Every other preset is validated the way `inheritConfig` and repository config consume it: resolved into the config extending it and validated as a whole.
// This deliberately does not use the `isPreset` leniency of `validateConfig()`, which lets a preset source keep selectors at its top level.
function presetUsage(groupName: string, presetName: string): RenovateConfig {
  const preset = `${groupName}:${presetName}`;
  if (packageRuleFragmentGroups.includes(groupName)) {
    return { packageRules: [{ extends: [preset], groupName: presetName }] };
  }
  return { extends: [preset] };
}

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

  for (const [groupName, groupPresets] of Object.entries(internal.groups)) {
    for (const presetName of Object.keys(groupPresets).filter(
      (key) =>
        key !== 'description' &&
        !ignoredPresets.includes(`${groupName}:${key}`),
    )) {
      it(`${`${groupName}:${presetName}`} validates`, async () => {
        try {
          const { config } = await resolveConfigPresets(
            presetUsage(groupName, presetName),
          );
          const configType = groupName === 'global' ? 'global' : 'repo';
          const res = await validateConfig(configType, config);
          expect(res.errors).toBeEmptyArray();
          expect(res.warnings).toBeEmptyArray();
        } catch (err) {
          if (err.validationError) {
            throw new Error(err.validationError);
          }
          throw err;
        }
      });
    }
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
