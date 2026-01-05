import type { RepoGlobalConfig } from '../../config/types';
import type { RepoParams } from './types';

describe('modules/platform/types', () => {
  it('`RepoParams` and `RepoGlobalConfig` types should be incompatible', () => {
    type RequiredRepoGlobalConfig = Required<RepoGlobalConfig>;
    type RequiredRepoParams = Required<RepoParams>;

    const globalConfig: Omit<
      RequiredRepoGlobalConfig,
      keyof RequiredRepoParams
    > = {} as any;
    const repoConfig: Omit<RequiredRepoParams, keyof RequiredRepoGlobalConfig> =
      {} as any;

    expectTypeOf(globalConfig).toEqualTypeOf<RequiredRepoGlobalConfig>();
    expectTypeOf(repoConfig).toEqualTypeOf<RequiredRepoParams>();
  });
});
