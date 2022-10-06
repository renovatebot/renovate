import detectIndent from 'detect-indent';
import { Fixtures } from '../../../../../test/fixtures';
import { mockedFunction } from '../../../../../test/util';

import { migrateConfig } from '../../../../config/migration';
import { logger } from '../../../../logger';
import { readLocalFile } from '../../../../util/fs';
import { getFileList } from '../../../../util/git';
import { detectRepoFileConfig } from '../../init/merge';
import { MigratedDataFactory, applyPrettierFormatting } from './migrated-data';

jest.mock('../../../../config/migration');
jest.mock('../../../../util/git');
jest.mock('../../../../util/fs');
jest.mock('../../init/merge');
jest.mock('detect-indent');

const rawNonMigrated = Fixtures.get('./renovate.json');
const rawNonMigratedJson5 = Fixtures.get('./renovate.json5');
const migratedData = Fixtures.getJson('./migrated-data.json');
const migratedDataJson5 = Fixtures.getJson('./migrated-data.json5');
const migratedConfigObj = Fixtures.getJson('./migrated.json');
const formattedMigratedData = Fixtures.getJson(
  './migrated-data-formatted.json'
);

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
        configFileRaw: rawNonMigrated,
      });
      mockedFunction(migrateConfig).mockReturnValue({
        isMigrated: true,
        migratedConfig: migratedConfigObj,
      });
      mockedFunction(getFileList).mockResolvedValue([]);
    });

    it('Calls getAsync a first when migration not needed', async () => {
      mockedFunction(migrateConfig).mockReturnValueOnce({
        isMigrated: false,
        migratedConfig: {},
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
        expect(data?.filename).toBe('renovate.json');
      });

      it('gets the content from the class instance', async () => {
        const data = await MigratedDataFactory.getAsync();
        expect(data?.content).toBe(migratedData.content);
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
        type: undefined,
        amount: 0,
        // TODO: incompatible types (#7154)
        indent: null as never,
      });
      MigratedDataFactory.reset();
      await expect(MigratedDataFactory.getAsync()).resolves.toEqual(
        migratedData
      );
    });

    it('Migrate a JSON5 config file', async () => {
      mockedFunction(detectRepoFileConfig).mockResolvedValueOnce({
        configFileName: 'renovate.json5',
        configFileRaw: rawNonMigratedJson5,
      });
      MigratedDataFactory.reset();
      await expect(MigratedDataFactory.getAsync()).resolves.toEqual(
        migratedDataJson5
      );
    });

    it('Returns nothing due to detectRepoFileConfig throwing', async () => {
      const err = new Error('error-message');
      mockedFunction(detectRepoFileConfig).mockRejectedValueOnce(err);
      MigratedDataFactory.reset();
      await expect(MigratedDataFactory.getAsync()).resolves.toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        { err },
        'MigratedDataFactory.getAsync() Error initializing renovate MigratedData'
      );
    });

    it('format and migrate a JSON config file', async () => {
      mockedFunction(detectRepoFileConfig).mockResolvedValueOnce({
        configFileName: 'renovate.json',
      });
      mockedFunction(getFileList).mockResolvedValue(['.prettierrc']);
      MigratedDataFactory.reset();
      await expect(MigratedDataFactory.getAsync()).resolves.toEqual(
        formattedMigratedData
      );
    });

    it('should not stop run for invalid package.json', async () => {
      mockedFunction(detectRepoFileConfig).mockResolvedValueOnce({
        configFileName: 'renovate.json',
        configFileRaw: 'abci',
      });
      mockedFunction(readLocalFile).mockResolvedValueOnce(rawNonMigrated);
      MigratedDataFactory.reset();
      await expect(MigratedDataFactory.getAsync()).resolves.toEqual(
        migratedData
      );
    });

    it('should not stop run for readLocalFile error', async () => {
      mockedFunction(detectRepoFileConfig).mockResolvedValueOnce({
        configFileName: 'renovate.json',
        configFileRaw: 'abci',
      });
      mockedFunction(readLocalFile).mockRejectedValueOnce(null);
      MigratedDataFactory.reset();
      await expect(MigratedDataFactory.getAsync()).resolves.toEqual(
        migratedData
      );
    });

    it('return original content if its invalid', async () => {
      await expect(
        applyPrettierFormatting(`{"name":"Rahul"`, 'json', {
          indent: '  ',
          amount: 2,
        })
      ).resolves.toBe(`{"name":"Rahul"`);
    });
  });
});
