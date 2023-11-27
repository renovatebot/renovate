import detectIndent from 'detect-indent';
import { Fixtures } from '../../../../../test/fixtures';
import { mockedFunction, scm } from '../../../../../test/util';

import { migrateConfig } from '../../../../config/migration';
import { logger } from '../../../../logger';
import { readLocalFile } from '../../../../util/fs';
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
  './migrated-data-formatted.json',
);

describe('workers/repository/config-migration/branch/migrated-data', () => {
  describe('MigratedDataFactory.getAsync', () => {
    beforeEach(() => {
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
        migratedData,
      );
      expect(detectRepoFileConfig).toHaveBeenCalledTimes(1);
    });

    it('Calls getAsync a second time to get the saved data from before', async () => {
      await expect(MigratedDataFactory.getAsync()).resolves.toEqual(
        migratedData,
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
        migratedData,
      );
    });

    it('Resets the factory and gets a new value with default indentation', async () => {
      const indent = {
        type: undefined,
        amount: 0,
        // TODO: incompatible types (#22198)
        indent: null as never,
      };
      mockedFunction(detectIndent).mockReturnValueOnce(indent);
      MigratedDataFactory.reset();
      await expect(MigratedDataFactory.getAsync()).resolves.toEqual({
        ...migratedData,
        indent,
      });
    });

    it('Migrate a JSON5 config file', async () => {
      mockedFunction(detectRepoFileConfig).mockResolvedValueOnce({
        configFileName: 'renovate.json5',
        configFileRaw: rawNonMigratedJson5,
      });
      MigratedDataFactory.reset();
      await expect(MigratedDataFactory.getAsync()).resolves.toEqual(
        migratedDataJson5,
      );
    });

    it('Returns nothing due to detectRepoFileConfig throwing', async () => {
      const err = new Error('error-message');
      mockedFunction(detectRepoFileConfig).mockRejectedValueOnce(err);
      MigratedDataFactory.reset();
      await expect(MigratedDataFactory.getAsync()).resolves.toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        { err },
        'MigratedDataFactory.getAsync() Error initializing renovate MigratedData',
      );
    });
  });

  describe('MigratedDataFactory.applyPrettierFormatting', () => {
    beforeAll(() => {
      mockedFunction(detectIndent).mockReturnValueOnce({
        type: 'space',
        amount: 2,
        indent: '  ',
      });
      mockedFunction(detectRepoFileConfig).mockResolvedValueOnce({
        configFileName: 'renovate.json',
        configFileRaw: rawNonMigrated,
      });
      mockedFunction(migrateConfig).mockReturnValueOnce({
        isMigrated: true,
        migratedConfig: migratedConfigObj,
      });
      MigratedDataFactory.reset();
    });

    beforeEach(() => {
      mockedFunction(scm.getFileList).mockResolvedValue([]);
    });

    it('does not format when no prettier config is present', async () => {
      const { content: unformatted } = migratedData;
      mockedFunction(readLocalFile).mockResolvedValueOnce(null);
      await MigratedDataFactory.getAsync();
      await expect(
        MigratedDataFactory.applyPrettierFormatting(migratedData),
      ).resolves.toEqual(unformatted);
    });

    it('does not format when failing to fetch package.json file', async () => {
      const { content: unformatted } = migratedData;
      mockedFunction(readLocalFile).mockRejectedValueOnce(null);
      await MigratedDataFactory.getAsync();
      await expect(
        MigratedDataFactory.applyPrettierFormatting(migratedData),
      ).resolves.toEqual(unformatted);
    });

    it('does not format when there is an invalid package.json file', async () => {
      const { content: unformatted } = migratedData;
      mockedFunction(readLocalFile).mockResolvedValueOnce('invalid json');
      await MigratedDataFactory.getAsync();
      await expect(
        MigratedDataFactory.applyPrettierFormatting(migratedData),
      ).resolves.toEqual(unformatted);
    });

    it('formats when prettier config file is found', async () => {
      const formatted = formattedMigratedData.content;
      mockedFunction(scm.getFileList).mockResolvedValue(['.prettierrc']);
      await MigratedDataFactory.getAsync();
      await expect(
        MigratedDataFactory.applyPrettierFormatting(migratedData),
      ).resolves.toEqual(formatted);
    });

    it('formats when finds prettier config inside the package.json file', async () => {
      const formatted = formattedMigratedData.content;
      mockedFunction(detectRepoFileConfig).mockResolvedValueOnce({
        configFileName: 'renovate.json',
      });
      mockedFunction(readLocalFile).mockResolvedValueOnce('{"prettier":{}}');
      await MigratedDataFactory.getAsync();
      await expect(
        MigratedDataFactory.applyPrettierFormatting(migratedData),
      ).resolves.toEqual(formatted);
    });

    it('formats with default 2 spaces', async () => {
      mockedFunction(scm.getFileList).mockResolvedValue(['.prettierrc']);
      await expect(
        applyPrettierFormatting(migratedData.content, 'json', {
          amount: 0,
          indent: '  ',
        }),
      ).resolves.toEqual(formattedMigratedData.content);
    });
  });
});
