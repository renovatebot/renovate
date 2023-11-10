import type { Indent } from 'detect-indent';
import JSON5 from 'json5';
import { Fixtures } from '../../../../../test/fixtures';
import { RenovateConfig, git, partial, scm } from '../../../../../test/util';
import { getConfig } from '../../../../config/defaults';
import { GlobalConfig } from '../../../../config/global';
import { MigratedDataFactory } from './migrated-data';
import type { MigratedData } from './migrated-data';
import { jsonStripWhitespaces, rebaseMigrationBranch } from './rebase';

jest.mock('../../../../util/git');

const formattedMigratedData = Fixtures.getJson(
  './migrated-data-formatted.json',
);

describe('workers/repository/config-migration/branch/rebase', () => {
  const prettierSpy = jest.spyOn(
    MigratedDataFactory,
    'applyPrettierFormatting',
  );

  beforeEach(() => {
    GlobalConfig.set({
      localDir: '',
    });
  });

  describe('rebaseMigrationBranch()', () => {
    const repoConfig = Fixtures.getJson('./renovate.json');
    const indent = '  ';
    const renovateConfigJson =
      JSON.stringify(repoConfig, undefined, indent) + '\n';
    const renovateConfigJson5 =
      JSON5.stringify(repoConfig, undefined, indent) + '\n';
    let config: RenovateConfig;
    const migratedConfigData: MigratedData = {
      content: '',
      filename: '',
      indent: partial<Indent>(),
    };

    beforeEach(() => {
      config = {
        ...getConfig(),
        repository: 'some/repo',
        baseBranch: 'dev',
        defaultBranch: 'master',
      };
    });

    it('does not rebase modified branch', async () => {
      scm.isBranchModified.mockResolvedValueOnce(true);

      await rebaseMigrationBranch(config, migratedConfigData);

      expect(scm.checkoutBranch).toHaveBeenCalledTimes(0);
      expect(scm.commitAndPush).toHaveBeenCalledTimes(0);
    });

    it.each([
      ['renovate.json', renovateConfigJson],
      ['renovate.json5', renovateConfigJson5],
    ])(
      'does nothing if branch is up to date (%s)',
      async (filename, rawConfig) => {
        git.getFile.mockResolvedValueOnce(rawConfig);
        migratedConfigData.filename = filename;
        migratedConfigData.content = rawConfig;

        await rebaseMigrationBranch(config, migratedConfigData);

        expect(scm.checkoutBranch).toHaveBeenCalledTimes(0);
        expect(scm.commitAndPush).toHaveBeenCalledTimes(0);
        expect(git.getFile).toHaveBeenCalledTimes(1);
      },
    );

    it.each([
      ['renovate.json', renovateConfigJson],
      ['renovate.json5', renovateConfigJson5],
    ])('rebases migration branch (%s)', async (filename, rawConfig) => {
      scm.isBranchBehindBase.mockResolvedValueOnce(true);
      prettierSpy.mockResolvedValueOnce('');
      migratedConfigData.filename = filename;
      migratedConfigData.content = rawConfig;

      await rebaseMigrationBranch(config, migratedConfigData);

      expect(scm.checkoutBranch).toHaveBeenCalledWith(config.defaultBranch);
      expect(scm.commitAndPush).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['renovate.json', renovateConfigJson],
      ['renovate.json5', renovateConfigJson5],
    ])(
      'applies prettier formatting when rebasing the migration branch (%s)',
      async (filename, rawConfig) => {
        const formatted = formattedMigratedData.content;
        prettierSpy.mockResolvedValueOnce(formattedMigratedData.content);
        scm.isBranchBehindBase.mockResolvedValueOnce(true);
        migratedConfigData.filename = filename;
        migratedConfigData.content = rawConfig;

        await rebaseMigrationBranch(config, migratedConfigData);

        expect(scm.checkoutBranch).toHaveBeenCalledWith(config.defaultBranch);
        expect(scm.commitAndPush).toHaveBeenCalledTimes(1);
        expect(scm.commitAndPush).toHaveBeenCalledWith({
          branchName: 'renovate/migrate-config',
          files: [
            {
              type: 'addition',
              path: filename,
              contents: formatted,
            },
          ],
          message: `Migrate config ${filename}`,
          platformCommit: false,
          baseBranch: 'dev',
        });
      },
    );

    it.each([
      ['renovate.json', renovateConfigJson],
      ['renovate.json5', renovateConfigJson5],
    ])(
      'does not rebases migration branch when in dryRun is on (%s)',
      async (filename, rawConfig) => {
        GlobalConfig.set({
          dryRun: 'full',
        });
        scm.isBranchBehindBase.mockResolvedValueOnce(true);
        migratedConfigData.filename = filename;
        migratedConfigData.content = rawConfig;

        await rebaseMigrationBranch(config, migratedConfigData);

        expect(scm.checkoutBranch).toHaveBeenCalledTimes(0);
        expect(scm.commitAndPush).toHaveBeenCalledTimes(0);
      },
    );
  });

  describe('jsonStripWhiteSpaces()', () => {
    it('should strip white spaces from json', () => {
      const formattedJson = JSON.stringify(formattedMigratedData, null, '  ');
      const strippedJson = jsonStripWhitespaces(formattedJson);
      // check if the white spaces were removed or not
      expect(strippedJson).toBe(JSON.stringify(formattedMigratedData));
    });
  });
});
