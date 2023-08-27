import { GlobalConfig } from './global';
import { getOptions } from './options';

describe('config/global', () => {
  it('make sure the RepoGlobalConfig array contains all options with globalOnly=true', () => {
    //collect default values of all globalOnly=true options in an array
    const allGlobalOnlyConfig = getOptions()
      .filter((opt) => opt.globalOnly === true)
      .map((opt) => {
        return { name: opt.name, default: opt.default ?? 'some-string' };
      });

    // write the options to an object
    const completeConfig: any = {};
    for (const option of allGlobalOnlyConfig) {
      completeConfig[option.name] = option.default;
    }

    expect(GlobalConfig.set(completeConfig)).toBe({});
  });
});
