import { massageConfig } from '../../massage';
import { validateConfig } from '../../validation';
import * as internal from '.';

jest.mock('../../../datasource/npm');

const ignoredPresets = ['default:group', 'default:timezone'];

describe('config/presets/internal', () => {
  for (const [groupName, groupPresets] of Object.entries(internal.groups)) {
    for (const [presetName, presetConfig] of Object.entries(groupPresets)) {
      const preset = `${groupName}:${presetName}`;
      if (presetName !== 'description' && !ignoredPresets.includes(preset)) {
        it(`${preset} validates`, async () => {
          const res = await validateConfig(massageConfig(presetConfig), true);
          expect(res.errors).toHaveLength(0);
          expect(res.warnings).toHaveLength(0);
        });
      }
    }
  }
});
