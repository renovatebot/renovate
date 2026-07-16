import { GlobalConfig } from './global.ts';
import type { RepoGlobalConfig } from './types.ts';

describe('config/global', () => {
  it('OPTIONS contains every key of RepoGlobalConfig', () => {
    // If this fails to compile, a field was added to (or removed from) `RepoGlobalConfig` without updating `GlobalConfig.OPTIONS` to match
    // Unlike the forward direction (every entry in OPTIONS is a valid key of RepoGlobalConfig), which is enforced by the `satisfies` clause on OPTIONS itself, this direction can't be caught by the compiler any other way: adding an optional field to an interface doesn't require every array of its keys to be updated
    expectTypeOf<(typeof GlobalConfig.OPTIONS)[number]>().toEqualTypeOf<
      keyof RepoGlobalConfig
    >();
  });

  it('all values in OPTIONS are sorted', () => {
    const defined = GlobalConfig.OPTIONS;

    const sorted = [...defined].sort();

    expect(defined, 'OPTIONS should be sorted alphabetically').toStrictEqual(
      sorted,
    );
  });
});
