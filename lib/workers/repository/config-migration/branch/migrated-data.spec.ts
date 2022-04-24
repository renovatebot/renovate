import { Fixtures } from '../../../../../test/fixtures';
import { loadJsonFixture, mockedFunction } from '../../../../../test/util';

import { migrateConfig } from '../../../../config/migration';
import { readLocalFile } from '../../../../util/fs';
import { detectRepoFileConfig } from '../../init/merge';
import { MigratedDataFactory } from './migrated-data';

jest.mock('../../../../config/migration');
jest.mock('../../../../util/fs');
jest.mock('../../init/merge');

const rawNonMigrated = Fixtures.get('./renovate.json');
const migratedData = loadJsonFixture('./migrated-data.json');
const migratedConfigObj = loadJsonFixture('./migrated.json');

describe('workers/repository/config-migration/branch/migrated-data', () => {
  describe('MigratedDataFactory.getAsync', () => {
    beforeEach(() => {
      jest.resetAllMocks();
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
      mockedFunction(migrateConfig).mockReturnValue({
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
        expect(data.fileName).toBe('renovate.json');
      });

      it('gets the content from the class instance', async () => {
        const data = await MigratedDataFactory.getAsync();
        expect(data.content).toBe(migratedData.migratedContent);
      });
    });

    it('Resets the factory and gets a new value', async () => {
      MigratedDataFactory.reset();
      await expect(MigratedDataFactory.getAsync()).resolves.toEqual(
        migratedData
      );
    });

    it('Returns nothing due to fs error', async () => {
      mockedFunction(readLocalFile).mockResolvedValueOnce(null);
      MigratedDataFactory.reset();
      await expect(MigratedDataFactory.getAsync()).resolves.toBeNull();
    });
  });
});
