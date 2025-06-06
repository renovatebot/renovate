import detectIndent from 'detect-indent';

import { migrateConfig } from '../../../../config/migration';
import { logger } from '../../../../logger';
import { readLocalFile } from '../../../../util/fs';
import { EditorConfig } from '../../../../util/json-writer';
import { detectRepoFileConfig } from '../../init/merge';
import { MigratedDataFactory, applyPrettierFormatting } from './migrated-data';
import { Fixtures } from '~test/fixtures';
import { scm } from '~test/util';

vi.mock('../../../../config/migration');
vi.mock('../../../../util/fs');
vi.mock('../../../../util/json-writer');
vi.mock('../../init/merge');
vi.mock('detect-indent');

const migratedData = Fixtures.getJson('./migrated-data.json');
const migratedDataJson5 = Fixtures.getJson('./migrated-data.json5');
const migratedConfigObj = Fixtures.getJson('./migrated.json');
const formattedMigratedData = Fixtures.getJson(
  './migrated-data-formatted.json',
);

describe('workers/repository/config-migration/branch/migrated-data', () => {
  describe('MigratedDataFactory.getAsync', () => {
    beforeEach(() => {
      vi.mocked(detectIndent).mockReturnValue({
        type: 'space',
        amount: 2,
        indent: '  ',
      });
      vi.mocked(detectRepoFileConfig).mockResolvedValue({
        configFileName: 'renovate.json',
      });
      vi.mocked(migrateConfig).mockReturnValue({
        isMigrated: true,
        migratedConfig: migratedConfigObj,
      });
    });

    it('Calls getAsync a first when migration not needed', async () => {
      vi.mocked(migrateConfig).mockReturnValueOnce({
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
      vi.mocked(detectIndent).mockReturnValueOnce(indent);
      MigratedDataFactory.reset();
      await expect(MigratedDataFactory.getAsync()).resolves.toEqual({
        ...migratedData,
        indent,
      });
    });

    it('Migrate a JSON5 config file', async () => {
      vi.mocked(detectRepoFileConfig).mockResolvedValueOnce({
        configFileName: 'renovate.json5',
      });
      MigratedDataFactory.reset();
      await expect(MigratedDataFactory.getAsync()).resolves.toEqual(
        migratedDataJson5,
      );
    });

    it('Returns nothing due to detectRepoFileConfig throwing', async () => {
      const err = new Error('error-message');
      vi.mocked(detectRepoFileConfig).mockRejectedValueOnce(err);
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
      vi.mocked(detectIndent).mockReturnValueOnce({
        type: 'space',
        amount: 2,
        indent: '  ',
      });
      vi.mocked(detectRepoFileConfig).mockResolvedValueOnce({
        configFileName: 'renovate.json',
      });
      vi.mocked(migrateConfig).mockReturnValueOnce({
        isMigrated: true,
        migratedConfig: migratedConfigObj,
      });
      MigratedDataFactory.reset();
    });

    beforeEach(() => {
      vi.mocked(scm.getFileList).mockResolvedValue([]);
    });

    it('does not format when no prettier config is present', async () => {
      const { content: unformatted } = migratedData;
      vi.mocked(readLocalFile).mockResolvedValueOnce(null);
      await MigratedDataFactory.getAsync();
      await expect(
        MigratedDataFactory.applyPrettierFormatting(migratedData),
      ).resolves.toEqual(unformatted);
    });

    it('does not format when failing to fetch package.json file', async () => {
      const { content: unformatted } = migratedData;
      vi.mocked(readLocalFile).mockRejectedValueOnce(null);
      await MigratedDataFactory.getAsync();
      await expect(
        MigratedDataFactory.applyPrettierFormatting(migratedData),
      ).resolves.toEqual(unformatted);
    });

    it('does not format when there is an invalid package.json file', async () => {
      const { content: unformatted } = migratedData;
      vi.mocked(readLocalFile).mockResolvedValueOnce('invalid json');
      await MigratedDataFactory.getAsync();
      await expect(
        MigratedDataFactory.applyPrettierFormatting(migratedData),
      ).resolves.toEqual(unformatted);
    });

    it('formats when prettier config file is found', async () => {
      const formatted = formattedMigratedData.content;
      vi.mocked(scm.getFileList).mockResolvedValue(['.prettierrc']);
      await MigratedDataFactory.getAsync();
      await expect(
        MigratedDataFactory.applyPrettierFormatting(migratedData),
      ).resolves.toEqual(formatted);
    });

    it('formats without prettier if in .renovaterc', async () => {
      vi.mocked(scm.getFileList).mockResolvedValue(['.prettierrc']);
      await MigratedDataFactory.getAsync();
      await expect(
        MigratedDataFactory.applyPrettierFormatting({
          ...migratedData,
          filename: '.renovaterc',
        }),
      ).resolves.toEqual(migratedData.content);
    });

    it('formats when finds prettier config inside the package.json file', async () => {
      const formatted = formattedMigratedData.content;
      vi.mocked(detectRepoFileConfig).mockResolvedValueOnce({
        configFileName: 'renovate.json',
      });
      vi.mocked(readLocalFile).mockResolvedValueOnce('{"prettier":{}}');
      await MigratedDataFactory.getAsync();
      await expect(
        MigratedDataFactory.applyPrettierFormatting(migratedData),
      ).resolves.toEqual(formatted);
    });

    it('formats with default 2 spaces', async () => {
      vi.mocked(scm.getFileList).mockResolvedValue([
        '.prettierrc',
        '.editorconfig',
      ]);
      vi.mocked(EditorConfig.getCodeFormat).mockResolvedValueOnce({
        maxLineLength: 80,
      });
      await expect(
        applyPrettierFormatting('.prettierrc', migratedData.content, 'json', {
          amount: 0,
          indent: '  ',
        }),
      ).resolves.toEqual(formattedMigratedData.content);
    });

    it('formats with printWith=Infinity', async () => {
      vi.mocked(scm.getFileList).mockResolvedValue([
        '.prettierrc',
        '.editorconfig',
      ]);
      vi.mocked(EditorConfig.getCodeFormat).mockResolvedValueOnce({
        maxLineLength: 'off',
      });
      await expect(
        applyPrettierFormatting(
          '.prettierrc',
          `{\n"extends":[":separateMajorReleases",":prImmediately",":renovatePrefix",":semanticPrefixFixDepsChoreOthers"]}`,
          'json',
          {
            amount: 0,
            indent: '  ',
          },
        ),
      ).resolves.toBe(
        `{\n  "extends": [":separateMajorReleases", ":prImmediately", ":renovatePrefix", ":semanticPrefixFixDepsChoreOthers"]\n}\n`,
      );
    });
  });
});
