import detectIndent from 'detect-indent';
import { Fixtures } from '../../../../../test/fixtures';
import { mockedFunction } from '../../../../../test/util';

import { migrateConfig } from '../../../../config/migration';
import { readLocalFile } from '../../../../util/fs';
import { detectRepoFileConfig } from '../../init/merge';
import { MigratedDataFactory } from './migrated-data';

jest.mock('../../../../config/migration');
jest.mock('../../../../util/fs');
jest.mock('../../init/merge');
jest.mock('detect-indent');

const rawNonMigrated = Fixtures.get('./renovate.json');
const rawNonMigratedJson5 = Fixtures.get('./renovate.json5');
const migratedData = Fixtures.getJson('./migrated-data.json');
const migratedDataJson5 = Fixtures.getJson('./migrated-data.json5');
const migratedConfigObj = Fixtures.getJson('./migrated.json');

describe('workers/repository/config-migration/branch/migrated-data', () => {
  describe('MigratedDataFactory.getAsync', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      mockedFunction(detectIndent).mockReturnValue({
        type: 'space',
        amount: 2,
        indent: '  ',
      });
      mockedFunction(detectRepoFileConfig).mockResolvedValue({
        configFileName: 'renovate.json',
      });
      mockedFunction(readLocalFile).mockResolvedValue(rawNonMigrated);
      mockedFunction(migrateConfig).mockReturnValue({
        isMigrated: true,
        migratedConfig: migratedConfigObj,
      });
    });

    it('Calls getAsync a first when migration not needed', async () => {
      mockedFunction(migrateConfig).mockReturnValueOnce({
        isMigrated: false,
        migratedConfig: null,
      });
      await expect(MigratedDataFactory.getAsync()).resolves.toBeNull();
    });

    it('Calls getAsync a first time to initialize the factory', async () => {
      await expect(MigratedDataFactory.getAsync()).resolves.toEqual(
        migratedData
      );
      expect(detectRepoFileConfig).toHaveBeenCalledTimes(1);
    });

    it('Calls getAsync a second time to get the saved data from before', async () => {
      await expect(MigratedDataFactory.getAsync()).resolves.toEqual(
        migratedData
      );
      expect(detectRepoFileConfig).toHaveBeenCalledTimes(0);
    });

    describe('MigratedData class', () => {
      it('gets the filename from the class instance', async () => {
        const data = await MigratedDataFactory.getAsync();
        expect(data.filename).toBe('renovate.json');
      });

      it('gets the content from the class instance', async () => {
        const data = await MigratedDataFactory.getAsync();
        expect(data.content).toBe(migratedData.content);
      });
    });

    it('Resets the factory and gets a new value', async () => {
      MigratedDataFactory.reset();
      await expect(MigratedDataFactory.getAsync()).resolves.toEqual(
        migratedData
      );
    });

    it('Resets the factory and gets a new value with default indentation', async () => {
      mockedFunction(detectIndent).mockReturnValueOnce({
        type: null,
        amount: 0,
        indent: null,
      });
      MigratedDataFactory.reset();
      await expect(MigratedDataFactory.getAsync()).resolves.toEqual(
        migratedData
      );
    });

    it('Migrate a JSON5 config file', async () => {
      mockedFunction(detectRepoFileConfig).mockResolvedValueOnce({
        configFileName: 'renovate.json5',
      });
      mockedFunction(readLocalFile).mockResolvedValueOnce(rawNonMigratedJson5);
      MigratedDataFactory.reset();
      await expect(MigratedDataFactory.getAsync()).resolves.toEqual(
        migratedDataJson5
      );
    });

    it('Returns nothing due to fs error', async () => {
      mockedFunction(detectRepoFileConfig).mockResolvedValueOnce({
        configFileName: null,
      });
      mockedFunction(readLocalFile).mockRejectedValueOnce(null);
      MigratedDataFactory.reset();
      await expect(MigratedDataFactory.getAsync()).resolves.toBeNull();
    });
  });
});
