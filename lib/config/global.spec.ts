import { GlobalConfig } from './global';
import { getOptions } from './options';

describe('config/global', () => {
  it('all values in OPTIONS are sorted', () => {
    const defined = GlobalConfig.OPTIONS;

    const sorted = [...defined].sort();

    expect(defined, 'OPTIONS should be sorted alphabetically').toStrictEqual(
      sorted,
    );
  });

  it('all globalOnly configuration options should be defined in OPTIONS', () => {
    const globalOnlyOptions = getOptions()
      .filter((o) => o.globalOnly)
      .map((o) => o.name);

    const defined = GlobalConfig.OPTIONS;

    expect(
      globalOnlyOptions,
      'All globalOnly options should be defined in OPTIONS',
    ).toEqual(defined);
  });
});
