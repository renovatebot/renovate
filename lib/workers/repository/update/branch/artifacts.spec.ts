import type { RenovateConfig } from '~test/util.ts';
import { partial, platform } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import { logger } from '../../../../logger/index.ts';
import type { BranchConfig } from '../../../types.ts';
import { setArtifactErrorStatus } from './artifacts.ts';

describe('workers/repository/update/branch/artifacts', () => {
  let config: BranchConfig;

  beforeEach(() => {
    GlobalConfig.set({});
    config = {
      baseBranch: 'base-branch',
      manager: 'some-manager',
      branchName: 'renovate/pin',
      upgrades: [],
      artifactErrors: [{ fileName: 'some' }],
      statusCheckNames: partial<RenovateConfig['statusCheckNames']>({
        artifactError: 'renovate/artifact',
      }),
    } satisfies BranchConfig;
  });

  describe('setArtifactsErrorStatus', () => {
    it('adds failed status when there are errors (default mode)', async () => {
      platform.getBranchStatusCheck.mockResolvedValueOnce(null);
      await setArtifactErrorStatus(config);
      expect(platform.setBranchStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'red',
          description: 'Artifact file update failure',
        }),
      );
    });

    it('skips status when already set to red', async () => {
      platform.getBranchStatusCheck.mockResolvedValueOnce('red');
      await setArtifactErrorStatus(config);
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });

    it('skips status if statusCheckNames.artifactError is null', async () => {
      await setArtifactErrorStatus({
        ...config,
        statusCheckNames: partial<RenovateConfig['statusCheckNames']>({
          artifactError: null,
        }),
      });

      expect(logger.debug).toHaveBeenCalledWith(
        'Status check is null or an empty string, skipping status check addition.',
      );
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });

    it('skips status if statusCheckNames.artifactError is empty string', async () => {
      await setArtifactErrorStatus({
        ...config,
        statusCheckNames: partial<RenovateConfig['statusCheckNames']>({
          artifactError: '',
        }),
      });

      expect(logger.debug).toHaveBeenCalledWith(
        'Status check is null or an empty string, skipping status check addition.',
      );
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });

    it('skips status if statusCheckNames is undefined', async () => {
      await setArtifactErrorStatus({
        ...config,
        statusCheckNames: undefined,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        'Status check is null or an empty string, skipping status check addition.',
      );
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });

    it('skips status (dry-run)', async () => {
      GlobalConfig.set({ dryRun: 'full' });
      await setArtifactErrorStatus(config);
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });

    it('skips status (no errors, default mode)', async () => {
      config.artifactErrors = [];
      await setArtifactErrorStatus(config);
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });

    describe('artifactsCheckWhen', () => {
      it('sets green status when mode is "always" and no errors', async () => {
        config.artifactErrors = [];
        config.artifactsCheckWhen = 'always';
        platform.getBranchStatusCheck.mockResolvedValueOnce(null);
        await setArtifactErrorStatus(config);
        expect(platform.setBranchStatus).toHaveBeenCalledWith(
          expect.objectContaining({
            state: 'green',
            description: 'Artifact file update success',
          }),
        );
      });

      it('sets red status when mode is "always" and there are errors', async () => {
        config.artifactsCheckWhen = 'always';
        platform.getBranchStatusCheck.mockResolvedValueOnce(null);
        await setArtifactErrorStatus(config);
        expect(platform.setBranchStatus).toHaveBeenCalledWith(
          expect.objectContaining({
            state: 'red',
            description: 'Artifact file update failure',
          }),
        );
      });

      it('skips status entirely when mode is "never"', async () => {
        config.artifactsCheckWhen = 'never';
        await setArtifactErrorStatus(config);
        expect(logger.debug).toHaveBeenCalledWith(
          'artifactsCheckWhen is set to "never", skipping artifacts status check.',
        );
        expect(platform.getBranchStatusCheck).not.toHaveBeenCalled();
        expect(platform.setBranchStatus).not.toHaveBeenCalled();
      });

      it('skips status entirely when mode is "never" even with errors', async () => {
        config.artifactsCheckWhen = 'never';
        config.artifactErrors = [{ fileName: 'some' }];
        await setArtifactErrorStatus(config);
        expect(platform.getBranchStatusCheck).not.toHaveBeenCalled();
        expect(platform.setBranchStatus).not.toHaveBeenCalled();
      });

      it('does not update when status already matches (always mode, green)', async () => {
        config.artifactErrors = [];
        config.artifactsCheckWhen = 'always';
        platform.getBranchStatusCheck.mockResolvedValueOnce('green');
        await setArtifactErrorStatus(config);
        expect(platform.setBranchStatus).not.toHaveBeenCalled();
      });

      it('sets red status in failed mode (default) when there are errors', async () => {
        config.artifactsCheckWhen = 'failed';
        platform.getBranchStatusCheck.mockResolvedValueOnce(null);
        await setArtifactErrorStatus(config);
        expect(platform.setBranchStatus).toHaveBeenCalledWith(
          expect.objectContaining({
            state: 'red',
            description: 'Artifact file update failure',
          }),
        );
      });

      it('skips status in failed mode when no errors', async () => {
        config.artifactsCheckWhen = 'failed';
        config.artifactErrors = [];
        await setArtifactErrorStatus(config);
        expect(platform.getBranchStatusCheck).not.toHaveBeenCalled();
        expect(platform.setBranchStatus).not.toHaveBeenCalled();
      });

      it('handles dry-run with always mode', async () => {
        GlobalConfig.set({ dryRun: 'full' });
        config.artifactErrors = [];
        config.artifactsCheckWhen = 'always';
        platform.getBranchStatusCheck.mockResolvedValueOnce(null);
        await setArtifactErrorStatus(config);
        expect(platform.setBranchStatus).not.toHaveBeenCalled();
      });
    });
  });
});
