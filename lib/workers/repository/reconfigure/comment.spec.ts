import { logger, partial, platform } from '../../../../test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { RenovateConfig } from '../../../config/types.ts';
import type { PackageFile } from '../../../modules/manager/types.ts';
import type { Pr } from '../../../modules/platform/index.ts';
import type { BranchConfig, BranchUpgradeConfig } from '../../types.ts';
import { ensureReconfigurePrComment, getConfigDesc } from './comment.ts';

describe('workers/repository/reconfigure/comment', () => {
  describe('ensureReconfigurePrComment()', () => {
    let config: RenovateConfig;
    let packageFiles: Record<string, PackageFile[]>;
    let branches: BranchConfig[];
    const reconfigureBranch = 'renovate/reconfigure';
    const reconfigurePr = partial<Pr>({ number: 1 });

    beforeEach(() => {
      config = {
        errors: [],
        warnings: [],
        description: [],
      };
      packageFiles = { npm: [{ packageFile: 'package.json', deps: [] }] };
      branches = [];
      platform.massageMarkdown.mockImplementation((input) => input);
      platform.ensureComment.mockResolvedValueOnce(true);
      GlobalConfig.reset();
    });

    it('ensures comment', async () => {
      expect(
        await ensureReconfigurePrComment(
          config,
          packageFiles,
          branches,
          reconfigureBranch,
          reconfigurePr,
        ),
      ).toBeTrue();
    });

    it('ensures comment - when no package files detected', async () => {
      expect(
        await ensureReconfigurePrComment(
          config,
          {},
          branches,
          reconfigureBranch,
          reconfigurePr,
        ),
      ).toBeTrue();
    });

    it('dryrun', async () => {
      GlobalConfig.set({ dryRun: 'full' });
      expect(
        await ensureReconfigurePrComment(
          config,
          packageFiles,
          branches,
          reconfigureBranch,
          reconfigurePr,
        ),
      ).toBeTrue();

      expect(logger.logger.info).toHaveBeenCalledWith(
        'DRY-RUN: Would check branch renovate/reconfigure',
      );
      expect(logger.logger.info).toHaveBeenLastCalledWith(
        'DRY-RUN: Would ensure comment',
      );
    });

    describe('when the PR body exceeds the platform limit', () => {
      beforeEach(() => {
        branches = [
          partial<BranchConfig>({
            prTitle: 'Update dependency foo to v2',
            branchName: 'renovate/foo-2.x',
            baseBranch: 'base',
            manager: 'npm',
            upgrades: [
              partial<BranchUpgradeConfig>({
                manager: 'npm',
                branchName: 'renovate/foo-2.x',
                updateType: 'major',
                depName: 'foo',
                newValue: '2.0.0',
              }),
            ],
          }),
        ];
      });

      it('replaces the full PR list and package files with their summaries', async () => {
        platform.maxBodyLength.mockReturnValueOnce(1);
        await ensureReconfigurePrComment(
          config,
          packageFiles,
          branches,
          reconfigureBranch,
          reconfigurePr,
        );

        expect(logger.logger.debug).toHaveBeenCalledWith(
          'Reconfigure PR body exceeds platform limit, switching to summary PR list and package files',
        );

        const prBody = platform.ensureComment.mock.calls[0][0].content;
        // the full PR list renders each branch as a `<details>` block, the summary uses a table instead
        expect(prBody).not.toContain('<details>');
        expect(prBody).toContain('| Manager | major |');
        // the full package files description lists files inline suffixed with the manager,
        // the summary groups them under a manager heading instead
        expect(prBody).not.toContain('`package.json` (npm)');
        expect(prBody).toContain('#### npm\n\n * `package.json`');
      });

      it('does not attempt to replace package files when none were detected', async () => {
        platform.maxBodyLength.mockReturnValueOnce(1);
        await ensureReconfigurePrComment(
          config,
          {},
          branches,
          reconfigureBranch,
          reconfigurePr,
        );

        const prBody = platform.ensureComment.mock.calls[0][0].content;
        expect(prBody).not.toContain('Detected Package Files');
        expect(prBody).toContain('| Manager | major |');
      });

      it('leaves the PR body untouched when it is within the platform limit', async () => {
        await ensureReconfigurePrComment(
          config,
          packageFiles,
          branches,
          reconfigureBranch,
          reconfigurePr,
        );

        expect(logger.logger.debug).not.toHaveBeenCalledWith(
          'Reconfigure PR body exceeds platform limit, switching to summary PR list and package files',
        );

        const prBody = platform.ensureComment.mock.calls[0][0].content;
        expect(prBody).toContain('<details>');
        expect(prBody).toContain('`package.json` (npm)');
      });
    });
  });

  describe('getConfigDesc', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      config = partial<RenovateConfig>();
    });

    it('returns empty', () => {
      const res = getConfigDesc(config);
      expect(res).toBe('');
    });

    it('returns a full list', () => {
      config.description = [
        'description 1',
        'description two',
        'something else',
        'this is Docker-only',
      ];
      const res = getConfigDesc(config);
      expect(res).toBe(`
### Configuration Summary

Based on the default config's presets, Renovate will:

  - description 1
  - description two
  - something else
  - this is Docker-only


---
`);
    });

    it('adds schedule', () => {
      config.schedule = ['before 5am'];
      const res = getConfigDesc(config);
      expect(res).toEqual(`
### Configuration Summary

Based on the default config's presets, Renovate will:

  - Run Renovate on following schedule: before 5am


---
`);
    });
  });
});
