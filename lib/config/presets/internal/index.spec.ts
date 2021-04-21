import { getName, mocked } from '../../../../test/util';
import { CONFIG_VALIDATION } from '../../../constants/error-messages';
import { massageConfig } from '../../massage';
import { validateConfig } from '../../validation';
import { resolveConfigPresets } from '../index';
import * as _npm from '../npm';
import * as internal from '.';

jest.mock('./npm');
jest.mock('../../../datasource/npm');

const npm = mocked(_npm);
npm.getPreset = jest.fn((_) => null);

const ignoredPresets = ['default:group', 'default:timezone'];

describe(getName(__filename), () => {
  it('fails for undefined internal preset', async () => {
    const preset = 'foo:bar';
    const presetConfig = { extends: [preset] };
    await expect(resolveConfigPresets(presetConfig)).rejects.toThrow(
      CONFIG_VALIDATION
    );
  });

  for (const [groupName, groupPresets] of Object.entries(internal.groups)) {
    for (const [presetName, presetConfig] of Object.entries(groupPresets)) {
      const preset = `${groupName}:${presetName}`;
      if (presetName !== 'description' && !ignoredPresets.includes(preset)) {
        it(`${preset} validates`, async () => {
          try {
            const config = await resolveConfigPresets(
              massageConfig(presetConfig)
            );
            const res = await validateConfig(config, true);
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
});
