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

  it('skips pr creation when migration is not needed', async () => {
    const branchList: string[] = [];
    mockedFunction(MigratedDataFactory.getAsync).mockResolvedValue(null);
    const res = await configMigration(config, branchList);
    expect(res).toMatchObject({ result: 'no-migration' });
    expect(checkConfigMigrationBranch).toHaveBeenCalledTimes(0);
    expect(ensureConfigMigrationPr).toHaveBeenCalledTimes(0);
  });

  it('skips pr creation if config found in package.json', async () => {
    const branchList: string[] = [];
    mockedFunction(MigratedDataFactory.getAsync).mockResolvedValue({
      content,
      indent: partial<Indent>(),
      filename: 'package.json',
    });
    const res = await configMigration(config, branchList);
    expect(res).toMatchObject({ result: 'no-migration' });
    expect(checkConfigMigrationBranch).toHaveBeenCalledTimes(0);
    expect(ensureConfigMigrationPr).toHaveBeenCalledTimes(0);
  });

  it('creates migration pr if needed', async () => {
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

  it('returns add-checkbox if migration pr exists but is created by another user', async () => {
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

  it('returns pr-modified incase the migration pr has been modified', async () => {
    const branchList: string[] = [];
    mockedFunction(checkConfigMigrationBranch).mockResolvedValue({
      migrationBranch: branchName,
      result: 'migration-branch-modified',
    });
    mockedFunction(ensureConfigMigrationPr).mockResolvedValue(
      partial<Pr>({
        number: 1,
      }),
    );
    const res = await configMigration(config, branchList);
    expect(res).toMatchObject({ result: 'pr-modified', prNumber: 1 });
    expect(branchList).toContainEqual(branchName);
    expect(ensureConfigMigrationPr).toHaveBeenCalledTimes(1);
  });

  it('returns add-checkbox if migration is needed but not demanded', async () => {
    const branchList: string[] = [];
    mockedFunction(checkConfigMigrationBranch).mockResolvedValue({
      result: 'no-migration-branch',
    });
    const res = await configMigration(config, branchList);
    expect(res).toMatchObject({ result: 'add-checkbox' });
    expect(branchList).toBeEmptyArray();
    expect(ensureConfigMigrationPr).toHaveBeenCalledTimes(0);
  });
});
