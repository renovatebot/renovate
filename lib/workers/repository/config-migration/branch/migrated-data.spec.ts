import {
  loadFixture,
  loadJsonFixture,
  mockedFunction,
} from '../../../../../test/util';

import { migrateAndValidate } from '../../../../config/migrate-validate';
import { readLocalFile } from '../../../../util/fs';
import { detectRepoFileConfig } from '../../init/merge';
import { MigratedDataFactory } from './migrated-data';

jest.mock('../../../../config/migrate-validate', () => ({
  migrateAndValidate: jest.fn(),
}));
jest.mock('../../../../util/fs');
jest.mock('../../init/merge');

const rawNonMigrated = loadFixture('./raw-non-migrated.json');
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
      mockedFunction(migrateAndValidate).mockResolvedValue(migratedConfigObj);
    });

    it('Calls getAsync first time to initialize the factory', async () => {
      await expect(MigratedDataFactory.getAsync({})).resolves.toEqual(
        migratedData
      );
    });

    it('Calls getAsync a second time to get the saved data from before', async () => {
      await expect(MigratedDataFactory.getAsync({})).resolves.toEqual(
        migratedData
      );
    });

    it('gets the filename from the MigratedData object', async () => {
      const asd = await MigratedDataFactory.getAsync({});
      expect(asd.fileName).toBe('renovate.json');
    });

    it('gets the content from the MigratedData object', async () => {
      const asd = await MigratedDataFactory.getAsync({});
      expect(asd.content).toBe(migratedData.migratedContent);
    });

    it('Resets the factory and gets a new value', async () => {
      MigratedDataFactory.reset();
      await expect(MigratedDataFactory.getAsync({})).resolves.toEqual(
        migratedData
      );
    });

    it('Returns nothing due to fs error', async () => {
      mockedFunction(readLocalFile).mockResolvedValue(null);
      MigratedDataFactory.reset();
      await expect(MigratedDataFactory.getAsync({})).resolves.toEqual({});
    });
  });
});
