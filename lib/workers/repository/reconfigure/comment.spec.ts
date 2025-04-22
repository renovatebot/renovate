import { logger, partial, platform } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RenovateConfig } from '../../../config/types';
import type { PackageFile } from '../../../modules/manager/types';
import type { Pr } from '../../../modules/platform';
import type { BranchConfig } from '../../types';
import { ensureReconfigurePrComment, getConfigDesc } from './comment';

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
        productLinks: {
          documentation: 'https://docs.renovatebot.com/',
          help: 'https://github.com/renovatebot/renovate/discussions',
          homepage: 'https://github.com/renovatebot/renovate',
        },
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
      config.packageFiles = [];
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
