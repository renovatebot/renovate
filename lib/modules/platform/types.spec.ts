import { partial } from '~test/util.ts';
import type { RepoGlobalConfig } from '../../config/types.ts';
import type { RepoParams } from './types.ts';

describe('modules/platform/types', () => {
  it('`RepoParams` and `RepoGlobalConfig` types should be incompatible', () => {
    type RequiredRepoGlobalConfig = Required<RepoGlobalConfig>;
    type RequiredRepoParams = Required<RepoParams>;

    const globalConfig =
      partial<Omit<RequiredRepoGlobalConfig, keyof RequiredRepoParams>>();
    const repoConfig =
      partial<Omit<RequiredRepoParams, keyof RequiredRepoGlobalConfig>>();

    expectTypeOf(globalConfig).toEqualTypeOf<RequiredRepoGlobalConfig>();
    expectTypeOf(repoConfig).toEqualTypeOf<RequiredRepoParams>();
  });
});
