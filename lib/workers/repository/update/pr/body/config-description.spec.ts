import { platform } from '../../../../../../test/util';
import type { BranchConfig } from '../../../../types';
import { getPrConfigDescription } from './config-description';

describe('workers/repository/update/pr/body/config-description', () => {
  describe('getPrConfigDescription', () => {
    const config: BranchConfig = {
      manager: 'some-manager',
      baseBranch: 'base',
      branchName: 'some-branch',
      upgrades: [],
    };

    beforeEach(() => {
      platform.getBranchForceRebase.mockResolvedValue(false);
    });

    it('renders stopUpdating=true', async () => {
      const res = await getPrConfigDescription({
        ...config,
        stopUpdating: true,
      });

      expect(res).toContain(
        `**Rebasing**: Never, or you tick the rebase/retry checkbox.`,
      );
    });

    it('renders rebaseWhen="never"', async () => {
      const res = await getPrConfigDescription({
        ...config,
        rebaseWhen: 'never',
      });

      expect(res).toContain(
        `**Rebasing**: Never, or you tick the rebase/retry checkbox.`,
      );
    });

    it.each([
      [false, true],
      [true, false],
      [true, true],
    ])(
      'renders rebaseWhen="auto" as "behind-base-branch" (automerge=%s, getBranchForceRebase()->%s)',
      async (automerge, platformBranchForceRebase) => {
        platform.getBranchForceRebase.mockResolvedValue(
          platformBranchForceRebase,
        );

        const res = await getPrConfigDescription({
          ...config,
          automerge,
          rebaseWhen: 'auto',
        });

        expect(res).toContain(`Whenever PR is behind base branch`);
      },
    );

    it('renders rebaseWhen="auto" (resolves to "conflicted")', async () => {
      const res = await getPrConfigDescription({
        ...config,
        automerge: false,
        rebaseWhen: 'auto',
      });

      expect(res).toContain(`Whenever PR becomes conflicted`);
    });

    it('renders rebaseWhen="behind-base-branch"', async () => {
      const res = await getPrConfigDescription({
        ...config,
        rebaseWhen: 'behind-base-branch',
      });

      expect(res).toContain(`Whenever PR is behind base branch`);
    });

    it('renders rebaseWhen="conflicted"', async () => {
      const res = await getPrConfigDescription({
        ...config,
        rebaseWhen: 'conflicted',
      });

      expect(res).toContain(`Whenever PR becomes conflicted`);
    });

    it('renders timezone', async () => {
      const res = await getPrConfigDescription({
        ...config,
        schedule: ['* 1 * * * *'],
        timezone: 'Europe/Istanbul',
      });
      expect(res).toContain(`in timezone Europe/Istanbul`);
    });

    it('renders UTC as the default timezone', async () => {
      const res = await getPrConfigDescription({
        ...config,
        schedule: ['* 1 * * * *'],
      });
      expect(res).toContain(`"* 1 * * * *" (UTC)`);
    });

    it('renders undefined schedule', async () => {
      const res = await getPrConfigDescription(config);
      expect(res).toContain(`At any time (no schedule defined).`);
    });

    it('renders recreateClosed=true', async () => {
      const res = await getPrConfigDescription({
        ...config,
        recreateClosed: true,
      });
      expect(res).toContain(`**Immortal**`);
    });

    it('does not render recreateClosed=false', async () => {
      const res = await getPrConfigDescription({
        ...config,
        recreateClosed: false,
      });
      expect(res).not.toContain(`**Immortal**`);
    });

    it('does not render recreateClosed=undefined', async () => {
      const res = await getPrConfigDescription(config);
      expect(res).not.toContain(`**Immortal**`);
    });

    it('renders singular', async () => {
      const res = await getPrConfigDescription({
        ...config,
        upgrades: [config],
      });
      expect(res).toContain(`this update`);
    });

    it('renders automerge', async () => {
      const res = await getPrConfigDescription({ ...config, automerge: true });
      expect(res).toContain(`**Automerge**: Enabled.`);
    });

    it('renders blocked automerge', async () => {
      const res = await getPrConfigDescription({
        ...config,
        automergedPreviously: true,
      });
      expect(res).toContain(
        `**Automerge**: Disabled because a matching PR was automerged previously.`,
      );
    });
  });
});
