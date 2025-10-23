import is from '@sindresorhus/is';
import * as manager from '../../modules/manager';
import * as platform from '../../modules/platform';
import { getOptions } from '.';

vi.unmock('../../modules/platform');

describe('config/options/index', () => {
  it('test manager should have no defaultConfig', () => {
    vi.doMock('../../modules/manager', () => ({
      getManagers: vi.fn(() => new Map().set('testManager', {})),
    }));

    const opts = getOptions();
    expect(opts.filter((o) => o.name === 'testManager')).toEqual([]);
  });

  it('supportedManagers should have valid names', () => {
    const opts = getOptions();
    const managerList = Array.from(manager.getManagers().keys());

    opts
      .filter((option) => option.supportedManagers)
      .forEach((option) => {
        expect(option.supportedManagers).toBeNonEmptyArray();
        for (const item of option.supportedManagers!) {
          expect(managerList).toContain(item);
        }
      });
  });

  it('supportedPlatforms should have valid names', () => {
    const opts = getOptions();
    const platformList = Array.from(platform.getPlatformList());

    opts
      .filter((option) => option.supportedPlatforms)
      .forEach((option) => {
        expect(option.supportedPlatforms).toBeNonEmptyArray();
        for (const item of option.supportedPlatforms!) {
          expect(platformList).toContain(item);
        }
      });
  });

  it('should not contain duplicate option names', () => {
    const optsNames = getOptions().map((option) => option.name);
    const optsNameSet = new Set(optsNames);
    expect(optsNames).toHaveLength(optsNameSet.size);
  });

  describe('every option with allowedValues and a default must have the default in allowedValues', () => {
    const opts = getOptions();
    for (const option of opts) {
      if (option.allowedValues && !is.nullOrUndefined(option.default)) {
        it(`${option.name}: \`${option.default}\` is in ${JSON.stringify(option.allowedValues)}`, () => {
          expect(option.allowedValues).toBeDefined();

          const defaults = Array.isArray(option.default)
            ? option.default
            : [option.default];
          for (const defVal of defaults) {
            expect(option.allowedValues).toContain(defVal);
          }
        });
      }
    }
  });
});
