import type { AllConfig } from '../../../config/types';
import { mergeStaticRepoEnvConfig } from './config';

describe('workers/repository/init/config', () => {
  describe('mergeRepoEnvConfig()', () => {
    type MergeRepoEnvTestCase = {
      name: string;
      env: NodeJS.ProcessEnv;
      currentConfig: AllConfig;
      wantConfig: AllConfig;
    };

    const testCases: MergeRepoEnvTestCase[] = [
      {
        name: 'it does nothing',
        env: {},
        currentConfig: { repositories: ['some/repo'] },
        wantConfig: { repositories: ['some/repo'] },
      },
      {
        name: 'it merges env with the current config',
        env: { RENOVATE_STATIC_REPO_CONFIG: '{"dependencyDashboard":true}' },
        currentConfig: { repositories: ['some/repo'] },
        wantConfig: {
          dependencyDashboard: true,
          repositories: ['some/repo'],
        },
      },
      {
        name: 'it ignores env with other renovate specific configuration options',
        env: { RENOVATE_CONFIG: '{"dependencyDashboard":true}' },
        currentConfig: { repositories: ['some/repo'] },
        wantConfig: { repositories: ['some/repo'] },
      },
    ];

    it.each(testCases)(
      '$name',
      async ({ env, currentConfig, wantConfig }: MergeRepoEnvTestCase) => {
        const got = await mergeStaticRepoEnvConfig(currentConfig, env);

        expect(got).toEqual(wantConfig);
      },
    );
  });
});
