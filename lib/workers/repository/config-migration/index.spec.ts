import { Fixtures } from '../../../../test/fixtures';
import { getConfig, mockedFunction } from '../../../../test/util';
import { checkConfigMigrationBranch } from './branch';
import { MigratedDataFactory } from './branch/migrated-data';
import { ensureConfigMigrationPr } from './pr';
import { configMigration } from './index';

jest.mock('./pr');
jest.mock('./branch');
jest.mock('./branch/migrated-data');

const content = Fixtures.getJson('./migrated-data.json', './branch');
const filename = 'renovate.json';
const branchName = 'renovate/config-migration';
const config = {
  ...getConfig(),
  configMigration: true,
};

describe('workers/repository/config-migration/index', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedFunction(MigratedDataFactory.getAsync).mockResolvedValue({
      filename,
      content,
    });
  });

  it('does nothing when config migration is disabled', async () => {
    await configMigration({ ...config, configMigration: false }, []);
    expect(MigratedDataFactory.getAsync).toHaveBeenCalledTimes(0);
    expect(checkConfigMigrationBranch).toHaveBeenCalledTimes(0);
    expect(ensureConfigMigrationPr).toHaveBeenCalledTimes(0);
  });

  it('ensures config migration PR when migrated', async () => {
    const branchList: string[] = [];
    mockedFunction(checkConfigMigrationBranch).mockResolvedValue(branchName);
    await configMigration(config, branchList);
    expect(branchList).toContainEqual(branchName);
    expect(ensureConfigMigrationPr).toHaveBeenCalledTimes(1);
  });

  it('skips pr creation when migration is not needed', async () => {
    const branchList: string[] = [];
    mockedFunction(checkConfigMigrationBranch).mockResolvedValue(null);
    await configMigration(config, branchList);
    expect(checkConfigMigrationBranch).toHaveBeenCalledTimes(1);
    expect(ensureConfigMigrationPr).toHaveBeenCalledTimes(0);
  });
});
