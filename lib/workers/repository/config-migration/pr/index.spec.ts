import { mock } from 'jest-mock-extended';
import {
  RenovateConfig,
  getConfig,
  partial,
  platform,
} from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import type { Pr } from '../../../../modules/platform';
import { hashBody } from '../../../../modules/platform/pr-body';
import { ensureConfigMigrationPr } from '.';

describe('workers/repository/config-migration/pr/index', () => {
  describe('ensureConfigMigrationPr()', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      GlobalConfig.set({
        dryRun: null,
      });
      jest.resetAllMocks();
      config = {
        ...getConfig(),
        configMigration: true,
        defaultBranch: 'main',
        errors: [],
        warnings: [],
        description: [],
      };
      jest
        .spyOn(platform, 'massageMarkdown')
        .mockImplementation((input) => input);
      platform.createPr.mockResolvedValueOnce(partial<Pr>({}));
    });

    let createPrBody: string;
    let hash: string;

    it('creates PR', async () => {
      await ensureConfigMigrationPr(config);
      expect(platform.getBranchPr).toHaveBeenCalledTimes(1);
      expect(platform.createPr).toHaveBeenCalledTimes(1);
      createPrBody = platform.createPr.mock.calls[0][0].prBody;
    });

    it('creates PR with default PR title', async () => {
      await ensureConfigMigrationPr({ ...config, onboardingPrTitle: null });
      expect(platform.getBranchPr).toHaveBeenCalledTimes(1);
      expect(platform.createPr).toHaveBeenCalledTimes(1);
      createPrBody = platform.createPr.mock.calls[0][0].prBody;
    });

    it('Founds an open PR and as it is up to date and returns', async () => {
      hash = hashBody(createPrBody);
      platform.getBranchPr.mockResolvedValueOnce(
        mock<Pr>({ bodyStruct: { hash } })
      );
      await ensureConfigMigrationPr(config);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
      expect(platform.createPr).toHaveBeenCalledTimes(0);
    });

    it('Founds an open PR and updates it', async () => {
      platform.getBranchPr.mockResolvedValueOnce(
        mock<Pr>({ bodyStruct: { hash: '' } })
      );
      await ensureConfigMigrationPr(config);
      expect(platform.updatePr).toHaveBeenCalledTimes(1);
      expect(platform.createPr).toHaveBeenCalledTimes(0);
    });

    it('Founds a closed PR and exit', async () => {
      platform.getBranchPr.mockResolvedValueOnce(null);
      platform.findPr.mockResolvedValueOnce(
        mock<Pr>({
          title: 'Config Migration',
        })
      );
      await ensureConfigMigrationPr(config);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
      expect(platform.createPr).toHaveBeenCalledTimes(0);
      expect(logger.debug).toHaveBeenCalledWith(
        'Found closed migration PR, exiting...'
      );
    });

    it('Dry runs and does not update out of date PR', async () => {
      GlobalConfig.set({
        dryRun: 'full',
      });
      platform.getBranchPr.mockResolvedValueOnce(
        mock<Pr>({ bodyStruct: { hash: '' } })
      );
      await ensureConfigMigrationPr(config);
      expect(platform.updatePr).toHaveBeenCalledTimes(0);
      expect(platform.createPr).toHaveBeenCalledTimes(0);
      expect(logger.debug).toHaveBeenCalledWith('Found open migration PR');
      expect(logger.debug).not.toHaveBeenLastCalledWith(
        `does not need updating`
      );
      expect(logger.info).toHaveBeenLastCalledWith(
        'DRY-RUN: Would update migration PR'
      );
    });

    it('Creates PR in dry run mode', async () => {
      GlobalConfig.set({
        dryRun: 'full',
      });
      await ensureConfigMigrationPr(config);
      expect(platform.getBranchPr).toHaveBeenCalledTimes(1);
      expect(platform.createPr).toHaveBeenCalledTimes(0);
      expect(logger.info).toHaveBeenLastCalledWith(
        'DRY-RUN: Would create migration PR'
      );
    });

    it('creates PR with labels', async () => {
      await ensureConfigMigrationPr({
        ...config,
        labels: ['label'],
        addLabels: ['label', 'additional-label'],
      });
      expect(platform.createPr).toHaveBeenCalledTimes(1);
      expect(platform.createPr.mock.calls[0][0].labels).toEqual([
        'label',
        'additional-label',
      ]);
    });

    it('creates PR with empty footer and header', async () => {
      await ensureConfigMigrationPr({
        ...config,
        prHeader: '',
        prFooter: '',
      });
      expect(platform.createPr).toHaveBeenCalledTimes(1);
      expect(platform.createPr.mock.calls[0][0].prBody).toMatchSnapshot();
    });

    it('creates PR with footer and header with trailing and leading newlines', async () => {
      await ensureConfigMigrationPr({
        ...config,
        prHeader: '\r\r\nThis should not be the first line of the PR',
        prFooter:
          'There should be several empty lines at the end of the PR\r\n\n\n',
      });
      expect(platform.createPr).toHaveBeenCalledTimes(1);
      expect(platform.createPr.mock.calls[0][0].prBody).toMatchSnapshot();
    });

    it('creates PR with footer and header using templating', async () => {
      config.baseBranch = 'some-branch';
      config.repository = 'test';
      await ensureConfigMigrationPr({
        ...config,
        prHeader: 'This is a header for platform:{{platform}}',
        prFooter:
          'And this is a footer for repository:{{repository}} baseBranch:{{baseBranch}}',
      });
      expect(platform.createPr).toHaveBeenCalledTimes(1);
      expect(platform.createPr.mock.calls[0][0].prBody).toMatch(
        /platform:github/
      );
      expect(platform.createPr.mock.calls[0][0].prBody).toMatch(
        /repository:test/
      );
      expect(platform.createPr.mock.calls[0][0].prBody).toMatch(
        /baseBranch:some-branch/
      );
      expect(platform.createPr.mock.calls[0][0].prBody).toMatchSnapshot();
    });
  });
});
