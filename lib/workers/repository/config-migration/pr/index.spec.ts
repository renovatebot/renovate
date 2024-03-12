import type { Indent } from 'detect-indent';
import type { RequestError, Response } from 'got';
import { mock } from 'jest-mock-extended';
import { Fixtures } from '../../../../../test/fixtures';
import {
  RenovateConfig,
  partial,
  platform,
  scm,
} from '../../../../../test/util';
import { getConfig } from '../../../../config/defaults';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import type { Pr } from '../../../../modules/platform';
import { hashBody } from '../../../../modules/platform/pr-body';
import { ConfigMigrationCommitMessageFactory } from '../branch/commit-message';
import type { MigratedData } from '../branch/migrated-data';
import { ensureConfigMigrationPr } from '.';

describe('workers/repository/config-migration/pr/index', () => {
  const spy = jest.spyOn(platform, 'massageMarkdown');
  const { configFileName, migratedContent } = Fixtures.getJson(
    './migrated-data.json',
  );
  const prTitle = new ConfigMigrationCommitMessageFactory(
    {},
    configFileName,
  ).getPrTitle();
  const migratedData: MigratedData = {
    content: migratedContent,
    filename: configFileName,
    indent: partial<Indent>(),
  };
  let config: RenovateConfig;

  beforeEach(() => {
    GlobalConfig.set({
      dryRun: null,
    });

    config = {
      ...getConfig(),
      configMigration: true,
      defaultBranch: 'main',
      description: [],
    };
  });

  describe('ensureConfigMigrationPr()', () => {
    beforeEach(() => {
      spy.mockImplementation((input) => input);
      platform.createPr.mockResolvedValueOnce(partial<Pr>());
    });

    let createPrBody: string;
    let hash: string;

    it('creates PR', async () => {
      await ensureConfigMigrationPr(config, migratedData);
      expect(platform.getBranchPr).toHaveBeenCalledTimes(1);
      expect(platform.createPr).toHaveBeenCalledTimes(1);
      createPrBody = platform.createPr.mock.calls[0][0].prBody;
    });

    it('creates PR with default PR title', async () => {
      await ensureConfigMigrationPr(
        { ...config, onboardingPrTitle: '' },
        migratedData,
      );
      expect(platform.getBranchPr).toHaveBeenCalledTimes(1);
      expect(platform.createPr).toHaveBeenCalledTimes(1);
      createPrBody = platform.createPr.mock.calls[0][0].prBody;
    });

    it('Founds an open PR and as it is up to date and returns', async () => {
      hash = hashBody(createPrBody);
      platform.getBranchPr.mockResolvedValueOnce(
        mock<Pr>({ bodyStruct: { hash }, title: prTitle }),
      );
      await ensureConfigMigrationPr(config, migratedData);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
      expect(platform.createPr).toHaveBeenCalledTimes(0);
    });

    it('Founds an open PR and updates it', async () => {
      platform.getBranchPr.mockResolvedValueOnce(
        mock<Pr>({ bodyStruct: { hash: '' } }),
      );
      await ensureConfigMigrationPr(config, migratedData);
      expect(platform.updatePr).toHaveBeenCalledTimes(1);
      expect(platform.createPr).toHaveBeenCalledTimes(0);
    });

    it('updates an open PR with unexpected PR title', async () => {
      hash = hashBody(createPrBody);
      platform.getBranchPr.mockResolvedValueOnce(
        mock<Pr>({ bodyStruct: { hash }, title: 'unexpected PR title' }),
      );
      await ensureConfigMigrationPr(config, migratedData);
      expect(platform.updatePr).toHaveBeenCalledTimes(1);
      expect(platform.updatePr.mock.calls[0][0]).toMatchObject({ prTitle });
      expect(platform.createPr).toHaveBeenCalledTimes(0);
    });

    it('Dry runs and does not update out of date PR', async () => {
      GlobalConfig.set({
        dryRun: 'full',
      });
      platform.getBranchPr.mockResolvedValueOnce(
        mock<Pr>({ bodyStruct: { hash: '' } }),
      );
      await ensureConfigMigrationPr(config, migratedData);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
      expect(platform.createPr).toHaveBeenCalledTimes(0);
      expect(logger.debug).toHaveBeenCalledWith('Found open migration PR');
      expect(logger.debug).not.toHaveBeenLastCalledWith(
        `does not need updating`,
      );
      expect(logger.info).toHaveBeenLastCalledWith(
        'DRY-RUN: Would update migration PR',
      );
    });

    it('Creates PR in dry run mode', async () => {
      GlobalConfig.set({
        dryRun: 'full',
      });
      await ensureConfigMigrationPr(config, migratedData);
      expect(platform.getBranchPr).toHaveBeenCalledTimes(1);
      expect(platform.createPr).toHaveBeenCalledTimes(0);
      expect(logger.info).toHaveBeenLastCalledWith(
        'DRY-RUN: Would create migration PR',
      );
    });

    it('creates PR with labels', async () => {
      await ensureConfigMigrationPr(
        {
          ...config,
          labels: ['label'],
          addLabels: ['label', 'additional-label'],
        },
        migratedData,
      );
      expect(platform.createPr).toHaveBeenCalledTimes(1);
      expect(platform.createPr.mock.calls[0][0].labels).toEqual([
        'label',
        'additional-label',
      ]);
    });

    it('creates PR with empty footer and header', async () => {
      await ensureConfigMigrationPr(
        {
          ...config,
          prHeader: '',
          prFooter: '',
        },
        migratedData,
      );
      expect(platform.createPr).toHaveBeenCalledTimes(1);
      expect(platform.createPr.mock.calls[0][0].prBody).toMatchSnapshot();
    });

    it('creates PR for JSON5 config file', async () => {
      await ensureConfigMigrationPr(config, {
        content: migratedContent,
        filename: 'renovate.json5',
        indent: partial<Indent>(),
      });
      expect(platform.createPr).toHaveBeenCalledTimes(1);
      expect(platform.createPr.mock.calls[0][0].prBody).toMatchSnapshot();
    });

    it('creates PR with footer and header with trailing and leading newlines', async () => {
      await ensureConfigMigrationPr(
        {
          ...config,
          prHeader: '\r\r\nThis should not be the first line of the PR',
          prFooter:
            'There should be several empty lines at the end of the PR\r\n\n\n',
        },
        migratedData,
      );
      expect(platform.createPr).toHaveBeenCalledTimes(1);
      expect(platform.createPr.mock.calls[0][0].prBody).toMatchSnapshot();
    });

    it('creates non-semantic PR title', async () => {
      await ensureConfigMigrationPr(
        {
          ...config,
          prHeader: '\r\r\nThis should not be the first line of the PR',
          prFooter:
            'There should be several empty lines at the end of the PR\r\n\n\n',
        },
        migratedData,
      );
      expect(platform.createPr).toHaveBeenCalledTimes(1);
      expect(platform.createPr.mock.calls[0][0].prTitle).toBe(
        'Migrate renovate config',
      );
    });

    it('creates semantic PR title', async () => {
      await ensureConfigMigrationPr(
        {
          ...config,
          commitMessagePrefix: '',
          semanticCommits: 'enabled',
          prHeader: '\r\r\nThis should not be the first line of the PR',
          prFooter:
            'There should be several empty lines at the end of the PR\r\n\n\n',
        },
        migratedData,
      );
      expect(platform.createPr).toHaveBeenCalledTimes(1);
      expect(platform.createPr.mock.calls[0][0].prTitle).toBe(
        'chore(config): migrate renovate config',
      );
    });

    it('creates PR with footer and header using templating', async () => {
      config.baseBranch = 'some-branch';
      config.repository = 'test';
      await ensureConfigMigrationPr(
        {
          ...config,
          prHeader: 'This is a header for platform:{{platform}}',
          prFooter:
            'And this is a footer for repository:{{repository}} baseBranch:{{baseBranch}}',
        },
        migratedData,
      );
      expect(platform.createPr).toHaveBeenCalledTimes(1);
      expect(platform.createPr.mock.calls[0][0].prBody).toMatch(
        /platform:github/,
      );
      expect(platform.createPr.mock.calls[0][0].prBody).toMatch(
        /repository:test/,
      );
      expect(platform.createPr.mock.calls[0][0].prBody).toMatch(
        /baseBranch:some-branch/,
      );
      expect(platform.createPr.mock.calls[0][0].prBody).toMatchSnapshot();
    });
  });

  describe('ensureConfigMigrationPr() throws', () => {
    const response = partial<Response>({ statusCode: 422 });
    const err = partial<RequestError>({ response });

    beforeEach(() => {
      GlobalConfig.reset();
      scm.deleteBranch.mockResolvedValue();
    });

    it('throws when trying to create a new PR', async () => {
      platform.createPr.mockRejectedValueOnce(err);
      await expect(ensureConfigMigrationPr(config, migratedData)).toReject();
      expect(scm.deleteBranch).toHaveBeenCalledTimes(0);
    });

    it('deletes branch when PR already exists but cannot find it', async () => {
      response.body = {
        errors: [{ message: 'A pull request already exists' }],
      };
      platform.createPr.mockRejectedValue(err);
      await expect(ensureConfigMigrationPr(config, migratedData)).toResolve();
      expect(logger.warn).toHaveBeenCalledWith(
        { err },
        'Migration PR already exists but cannot find it. It was probably created by a different user.',
      );
      expect(scm.deleteBranch).toHaveBeenCalledTimes(1);
    });
  });
});
