import { type RenovateConfig, logger, partial } from '~test/util.ts';
import { getConfig } from '../../../config/defaults.ts';
import type { PackageFile } from '../../../modules/manager/types.ts';
import { unskipLockfileOnlyDeps } from './lockfile-only-deps.ts';

function packageFiles(): Record<string, PackageFile[]> {
  return {
    pep621: [
      partial<PackageFile>({
        packageFile: 'pyproject.toml',
        deps: [
          {
            depName: 'transitive-dep',
            packageName: 'transitive-dep',
            datasource: 'pypi',
            lockedVersion: '1.0.0',
            skipReason: 'lockfile-only',
            skipStage: 'extract',
          },
          {
            depName: 'ignored-dep',
            packageName: 'ignored-dep',
            datasource: 'pypi',
            lockedVersion: '1.0.0',
            skipReason: 'ignored',
          },
        ],
      }),
    ],
  };
}

const alertRule = {
  matchDatasources: ['pypi'],
  matchPackageNames: ['transitive-dep'],
  matchCurrentVersion: '< 2.0.0',
  isVulnerabilityAlert: true,
};

describe('workers/repository/process/lockfile-only-deps', () => {
  let config: RenovateConfig;

  beforeEach(() => {
    config = getConfig();
  });

  it('does nothing when no vulnerability alerts are configured', async () => {
    const files = packageFiles();

    await unskipLockfileOnlyDeps(config, files);

    expect(files.pep621[0].deps[0].skipReason).toBe('lockfile-only');
  });

  it('clears the skip reason when an alert matches', async () => {
    config.packageRules = [alertRule];
    const files = packageFiles();

    await unskipLockfileOnlyDeps(config, files);

    expect(files.pep621[0].deps[0]).not.toHaveProperty('skipReason');
    expect(files.pep621[0].deps[0]).not.toHaveProperty('skipStage');
    expect(logger.logger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ depName: 'transitive-dep' }),
      'Clearing skipReason=lockfile-only for transitive-dep, as a vulnerability alert matches it',
    );
  });

  it('keeps the skip reason when no alert matches the dependency', async () => {
    config.packageRules = [{ ...alertRule, matchPackageNames: ['other-dep'] }];
    const files = packageFiles();

    await unskipLockfileOnlyDeps(config, files);

    expect(files.pep621[0].deps[0].skipReason).toBe('lockfile-only');
  });

  it('leaves other skip reasons untouched', async () => {
    config.packageRules = [
      { ...alertRule, matchPackageNames: ['ignored-dep'] },
    ];
    const files = packageFiles();

    await unskipLockfileOnlyDeps(config, files);

    expect(files.pep621[0].deps[1].skipReason).toBe('ignored');
  });

  it('skips package files without lockfile-only dependencies', async () => {
    config.osvVulnerabilityAlerts = true;
    const files: Record<string, PackageFile[]> = {
      pep621: [
        partial<PackageFile>({ packageFile: 'pyproject.toml', deps: [] }),
      ],
    };

    await unskipLockfileOnlyDeps(config, files);

    expect(files.pep621[0].deps).toBeEmpty();
  });
});
