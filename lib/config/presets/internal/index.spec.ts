import { resolveConfigPresets } from '../';
import { CONFIG_VALIDATION } from '../../../constants/error-messages';
import { GlobalConfig } from '../../global';
import { massageConfig } from '../../massage';
import { validateConfig } from '../../validation';
import * as npm from '../npm';
import * as internal from '.';

jest.mock('../npm');
jest.mock('../../../modules/datasource/npm');

jest.spyOn(npm, 'getPreset').mockResolvedValue(undefined);

const ignoredPresets = ['default:group', 'default:timezone'];

describe('config/presets/internal/index', () => {
  it('fails for undefined internal preset', async () => {
    const preset = 'foo:bar';
    const presetConfig = { extends: [preset] };
    await expect(resolveConfigPresets(presetConfig)).rejects.toThrow(
      CONFIG_VALIDATION,
    );
  });

  for (const [groupName, groupPresets] of Object.entries(internal.groups)) {
    for (const [presetName, presetConfig] of Object.entries(groupPresets)) {
      const preset = `${groupName}:${presetName}`;
      if (presetName !== 'description' && !ignoredPresets.includes(preset)) {
        it(`${preset} validates`, async () => {
          try {
            const config = await resolveConfigPresets(
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
      .forEach((preset) => expect(preset).not.toMatch(/{{.*}}/));
  });
});
