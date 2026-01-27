import { isNullOrUndefined } from '@sindresorhus/is';
import * as manager from '../../modules/manager/index.ts';
import * as platform from '../../modules/platform/index.ts';
import { getOptions } from './index.ts';

vi.unmock('../../modules/platform');

const options = getOptions();
const optionNames = new Set(options.map((o) => o.name));

describe('config/options/index', () => {
  it('test manager should have no defaultConfig', () => {
    vi.doMock('../../modules/manager/index.ts', () => ({
      getManagers: vi.fn(() => new Map().set('testManager', {})),
    }));

    const opts = getOptions();
    expect(opts.filter((o) => o.name === 'testManager')).toEqual([]);
  });

  it('supportedManagers should have valid names', () => {
    const managerList = Array.from(manager.getManagers().keys());

    for (const option of options.filter((o) => o.supportedManagers)) {
      expect(option.supportedManagers).toBeNonEmptyArray();
      for (const item of option.supportedManagers!) {
        expect(managerList).toContain(item);
      }
    }
  });

  it('supportedPlatforms should have valid names', () => {
    const platformList = Array.from(platform.getPlatformList());

    for (const option of options.filter((o) => o.supportedPlatforms)) {
      expect(option.supportedPlatforms).toBeNonEmptyArray();
      for (const item of option.supportedPlatforms!) {
        expect(platformList).toContain(item);
      }
    }
  });

  it('should not contain duplicate option names', () => {
    const optsNames = options.map((option) => option.name);
    expect(optsNames).toHaveLength(optionNames.size);
  });

  describe('allowedValues', () => {
    const optionsWithDefaults = options.filter(
      (o) => o.allowedValues && !isNullOrUndefined(o.default),
    );

    it.each(optionsWithDefaults)('$name default is in allowedValues', (option) => {
      const defaults = Array.isArray(option.default)
        ? option.default
        : [option.default];
      for (const defVal of defaults) {
        expect(option.allowedValues).toContain(defVal);
      }
    });
  });

  describe('requiredIf siblingProperties', () => {
    const siblingRefs = options.flatMap((option) =>
      (option.requiredIf ?? []).flatMap((req) =>
        req.siblingProperties.map((prop) => ({
          option: option.name,
          property: prop.property,
          value: prop.value,
        })),
      ),
    );

    it.each(siblingRefs)('$option → $property is valid option', ({ property }) => {
      expect(optionNames).toContain(property);
    });

    const refsWithAllowedValues = siblingRefs
      .map((ref) => {
        const target = options.find((o) => o.name === ref.property);
        return target?.allowedValues
          ? { ...ref, allowedValues: target.allowedValues }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    it.each(refsWithAllowedValues)(
      '$option → $property value is allowed',
      ({ value, allowedValues }) => {
        expect(allowedValues).toContain(value);
      },
    );
  });
});
