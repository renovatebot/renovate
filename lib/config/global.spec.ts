import { GlobalConfig } from './global.ts';
import { getOptions } from './options/index.ts';

describe('config/global', () => {
  it('all values in OPTIONS are sorted', () => {
    const defined = GlobalConfig.OPTIONS;

    const sorted = [...defined].sort();

    expect(defined, 'OPTIONS should be sorted alphabetically').toStrictEqual(
      sorted,
    );
  });

  it('all globalOnly configuration options should be defined in OPTIONS', () => {
    // TODO #39685 we need to migrate these over
    const optionsThatStillNeedMigrating = new Set([
      'autodiscover',
      'autodiscoverFilter',
      'autodiscoverNamespaces',
      'autodiscoverProjects',
      'autodiscoverTopics',
      'baseDir',
      'configValidationError',
      'deleteAdditionalConfigFile',
      'deleteConfigFile',
      'detectGlobalManagerConfig',
      'detectHostRulesFromEnv',
      'force',
      'forceCli',
      'forkCreation',
      'forkOrg',
      'forkToken',
      'gitNoVerify',
      'gitPrivateKey',
      'gitPrivateKeyPassphrase',
      'gitUrl',
      'globalExtends',
      'inheritConfig',
      'inheritConfigFileName',
      'inheritConfigRepoName',
      'inheritConfigStrict',
      'logContext',
      'mergeConfidenceDatasources',
      'mergeConfidenceEndpoint',
      'onboardingRebaseCheckbox',
      'optimizeForDisabled',
      'password',
      'persistRepoData',
      'prCommitsPerRunLimit',
      'privateKey',
      'privateKeyOld',
      'privateKeyPath',
      'privateKeyPathOld',
      'processEnv',
      'redisPrefix',
      'redisUrl',
      'reportFormatting',
      'reportPath',
      'reportType',
      'repositories',
      'repositoryCache',
      'repositoryCacheType',
      'secrets',
      'token',
      'unicodeEmoji',
      'useCloudMetadataServices',
      'username',
      'variables',
      'writeDiscoveredRepos',
    ]);

    const globalOnlyOptions = getOptions()
      .filter((o) => o.globalOnly)
      .map((o) => o.name)
      // TODO #39685 there are still some options that need migrating
      .filter((o) => !optionsThatStillNeedMigrating.has(o))
      .sort();

    const defined = Array.from(GlobalConfig.OPTIONS)
      // not actually a config option
      .filter((o) => o !== 'localDir')
      // toolSettings at an admin level can be used to specify a maximum for the setting, but is also possible to set at a repo level, so can't be marked as `globalOnly`
      .filter((o) => o !== 'toolSettings');
    expect(
      globalOnlyOptions,
      'All globalOnly options should be defined in OPTIONS',
    ).toEqual(defined);
  });
});
