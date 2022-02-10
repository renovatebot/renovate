import * as manager from '../../manager';
import * as platform from '../../platform';
import { getOptions } from '.';

jest.unmock('../../platform');

describe('config/options/index', () => {
  it('test manager should have no defaultConfig', () => {
    jest.mock('../../manager', () => ({
      getManagers: jest.fn(() => new Map().set('testManager', {})),
    }));

    const opts = getOptions();
    expect(opts.filter((o) => o.name === 'testManager')).toEqual([]);
  });

  it('supportedManagers should have valid names', () => {
    jest.unmock('../../manager');
    const opts = getOptions();
    const managerList = Array.from(manager.getManagers().keys());

    opts
      .filter((option) => option.supportedManagers)
      .forEach((option) => {
        expect(option.supportedManagers).toBeNonEmptyArray();
        for (const item of option.supportedManagers as string[]) {
          expect(managerList).toContain(item);
        }
      });
  });

  it('supportedPlatforms should have valid names', () => {
    jest.unmock('../../platform');
    const opts = getOptions();
    const platformList = Array.from(platform.getPlatforms().keys());

    opts
      .filter((option) => option.supportedPlatforms)
      .forEach((option) => {
        expect(option.supportedPlatforms).toBeNonEmptyArray();
        for (const item of option.supportedPlatforms as string[]) {
          expect(platformList).toContain(item);
        }
      });
  });
});
