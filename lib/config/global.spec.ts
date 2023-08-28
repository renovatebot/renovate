import { getDefault } from './defaults';
import { GlobalConfig } from './global';
import { getOptions } from './options';

describe('config/global', () => {
  it('make sure the RepoGlobalConfig array contains all options with globalOnly=true', () => {
    // Gather default values of globalOnly=true options into an array.
    const globalOnlyConfigOptions = getOptions()
      .filter((opt) => opt.globalOnly === true)
      .map((opt) => {
        return { name: opt.name, default: getDefault(opt) };
      });

    const completeGlobalOnlyConfig: any = {};
    for (const option of globalOnlyConfigOptions) {
      completeGlobalOnlyConfig[option.name] = option.default;
    }

    // The method GlobalConfig.set takes an object as input, extracts all options with globalOnly=true from it,
    // and transfers them to GlobalConfig.config. Any such options are then removed from the original object,
    // effectively emptying it. If the object still retains fields with globalOnly=true that are not present in
    // GlobalConfig.OPTIONS and RepoGlobalConfig, it implies missing definitions.
    expect(GlobalConfig.set(completeGlobalOnlyConfig)).toEqual({});
  });
});
