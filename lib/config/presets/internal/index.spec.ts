import { resolveConfigPresets } from '../';
import { CONFIG_VALIDATION } from '../../../constants/error-messages';
import { massageConfig } from '../../massage';
import { validateConfig } from '../../validation';
import * as npm from '../npm';
import * as internal from '.';

jest.mock('./npm');
jest.mock('../../../modules/datasource/npm');

jest.spyOn(npm, 'getPreset').mockResolvedValue(undefined);

const ignoredPresets = ['default:group', 'default:timezone'];

describe('config/presets/internal/index', () => {
  it('fails for undefined internal preset', async () => {
    const preset = 'foo:bar';
    const presetConfig = { extends: [preset] };
    await expect(resolveConfigPresets(presetConfig)).rejects.toThrow(
      CONFIG_VALIDATION
    );
  });

  it('contains all default presets', () => {
    expect(internal.groups['default']).toMatchSnapshot();
  });

  it('contains all compatibility presets', () => {
    expect(internal.groups['compatibility']).toMatchSnapshot();
  });

  it('contains all config presets', () => {
    expect(internal.groups['config']).toMatchSnapshot();
  });

  it('contains all docker presets', () => {
    expect(internal.groups['docker']).toMatchSnapshot();
  });

  it('contains all group presets', () => {
    expect(internal.groups['group']).toMatchSnapshot();
  });

  it('contains all helpers presets', () => {
    expect(internal.groups['helpers']).toMatchSnapshot();
  });

  it('contains all index presets', () => {
    expect(internal.groups).toMatchSnapshot();
  });

  it('contains all monorepo presets', () => {
    expect(internal.groups['monorepo']).toMatchSnapshot();
  });

  it('contains all npm presets', () => {
    expect(internal.groups['npm']).toMatchSnapshot();
  });

  it('contains all packages presets', () => {
    expect(internal.groups['packages']).toMatchSnapshot();
  });

  it('contains all preview presets', () => {
    expect(internal.groups['preview']).toMatchSnapshot();
  });

  it('contains all regex-managers presets', () => {
    expect(internal.groups['regexManagers']).toMatchSnapshot();
  });

  it('contains all schedule presets', () => {
    expect(internal.groups['schedule']).toMatchSnapshot();
  });

  it('contains all workarounds presets', () => {
    expect(internal.groups['workarounds']).toMatchSnapshot();
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
