import type { Indent } from 'detect-indent';
import { Fixtures } from '../../../../test/fixtures';
import { mockedFunction, partial } from '../../../../test/util';
import { getConfig } from '../../../config/defaults';
import type { Pr } from '../../../modules/platform/types';
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
    mockedFunction(MigratedDataFactory.getAsync).mockResolvedValue({
      filename,
      content,
      indent: partial<Indent>(),
    });
  });

  it('does nothing when in silent mode', async () => {
    const res = await configMigration({ ...config, mode: 'silent' }, []);
    expect(res).toMatchObject({ result: 'no-migration' });
    expect(MigratedDataFactory.getAsync).toHaveBeenCalledTimes(0);
    expect(checkConfigMigrationBranch).toHaveBeenCalledTimes(0);
    expect(ensureConfigMigrationPr).toHaveBeenCalledTimes(0);
  });

  it('ensures config migration PR when migrated', async () => {
    const branchList: string[] = [];
    mockedFunction(checkConfigMigrationBranch).mockResolvedValue({
      migrationBranch: branchName,
      result: 'migration-branch-exists',
    });
    mockedFunction(ensureConfigMigrationPr).mockResolvedValue(
      partial<Pr>({ number: 1 }),
    );
    const res = await configMigration(config, branchList);
    expect(res).toMatchObject({ result: 'pr-exists', prNumber: 1 });
    expect(branchList).toContainEqual(branchName);
    expect(ensureConfigMigrationPr).toHaveBeenCalledTimes(1);
  });

  it('skips pr creation when migration is not needed', async () => {
    const branchList: string[] = [];
    mockedFunction(checkConfigMigrationBranch).mockResolvedValue({
      result: 'no-migration',
    });
    const res = await configMigration(config, branchList);
    expect(res).toMatchObject({ result: 'no-migration' });
    expect(checkConfigMigrationBranch).toHaveBeenCalledTimes(1);
    expect(ensureConfigMigrationPr).toHaveBeenCalledTimes(0);
  });

  it('adds a checkbox incase a migration pr exists but is created by a different user', async () => {
    const branchList: string[] = [];
    mockedFunction(checkConfigMigrationBranch).mockResolvedValue({
      migrationBranch: branchName,
      result: 'migration-branch-exists',
    });
    mockedFunction(ensureConfigMigrationPr).mockResolvedValue(null);
    const res = await configMigration(config, branchList);
    expect(res).toMatchObject({ result: 'add-checkbox' });
    expect(branchList).toContainEqual(branchName);
    expect(ensureConfigMigrationPr).toHaveBeenCalledTimes(1);
  });
});
