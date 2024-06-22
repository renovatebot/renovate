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

    it('renders stopUpdating=true', () => {
      const res = getPrConfigDescription({
        ...config,
        stopUpdating: true,
      });

      expect(res).toContain(
        `**Rebasing**: Never, or you tick the rebase/retry checkbox.`,
      );
    });

    it('renders rebaseWhen="never"', () => {
      const res = getPrConfigDescription({
        ...config,
        rebaseWhen: 'never',
      });

      expect(res).toContain(
        `**Rebasing**: Never, or you tick the rebase/retry checkbox.`,
      );
    });

    it('renders rebaseWhen="behind-base-branch"', () => {
      const res = getPrConfigDescription({
        ...config,
        rebaseWhen: 'behind-base-branch',
      });

      expect(res).toContain(`Whenever PR is behind base branch`);
    });

    it('renders timezone', () => {
      const res = getPrConfigDescription({
        ...config,
        schedule: ['* 1 * * * *'],
        timezone: 'Europe/Istanbul',
      });
      expect(res).toContain(`in timezone Europe/Istanbul`);
    });

    it('renders UTC as the default timezone', () => {
      const res = getPrConfigDescription({
        ...config,
        schedule: ['* 1 * * * *'],
      });
      expect(res).toContain(`"* 1 * * * *" (UTC)`);
    });

    it('renders undefined schedule', () => {
      const res = getPrConfigDescription(config);
      expect(res).toContain(`At any time (no schedule defined).`);
    });

    it('renders recreateClosed=true', () => {
      const res = getPrConfigDescription({
        ...config,
        recreateClosed: true,
      });
      expect(res).toContain(`**Immortal**`);
    });

    it('does not render recreateClosed=false', () => {
      const res = getPrConfigDescription({
        ...config,
        recreateClosed: false,
      });
      expect(res).not.toContain(`**Immortal**`);
    });

    it('does not render recreateClosed=undefined', () => {
      const res = getPrConfigDescription(config);
      expect(res).not.toContain(`**Immortal**`);
    });

    it('renders singular', () => {
      const res = getPrConfigDescription({
        ...config,
        upgrades: [config],
      });
      expect(res).toContain(`this update`);
    });

    it('renders automerge', () => {
      const res = getPrConfigDescription({ ...config, automerge: true });
      expect(res).toContain(`**Automerge**: Enabled.`);
    });

    it('renders blocked automerge', () => {
      const res = getPrConfigDescription({
        ...config,
        automergedPreviously: true,
      });
      expect(res).toContain(
        `**Automerge**: Disabled because a matching PR was automerged previously.`,
      );
    });
  });
});
