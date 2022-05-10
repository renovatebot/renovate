import { mocked } from '../../../../../../test/util';
import { BranchStatus } from '../../../../../types';
import type { BranchConfig } from '../../../../types';
import * as _checks from '../../branch/status-checks';
import { getPrConfigDescription } from './config-description';

jest.mock('../../branch/status-checks');
const checks = mocked(_checks);

describe('workers/repository/update/pr/body/config-description', () => {
  describe('getPrConfigDescription', () => {
    const config: BranchConfig = {
      branchName: 'some-branch',
      upgrades: [],
    };

    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('renders stopUpdating=true', async () => {
      const res = await getPrConfigDescription({
        ...config,
        stopUpdating: true,
      });

      expect(res).toContain(
        `**Rebasing**: Never, or you tick the rebase/retry checkbox.`
      );
    });

    it('renders rebaseWhen="never"', async () => {
      const res = await getPrConfigDescription({
        ...config,
        rebaseWhen: 'never',
      });

      expect(res).toContain(
        `**Rebasing**: Never, or you tick the rebase/retry checkbox.`
      );
    });

    it('renders rebaseWhen="behind-base-branch"', async () => {
      const res = await getPrConfigDescription({
        ...config,
        rebaseWhen: 'behind-base-branch',
      });

      expect(res).toContain(`Whenever PR is behind base branch`);
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
      expect(res).toContain(`**Schedule**: "* 1 * * * *" (UTC).`);
    });

    it('renders undefined schedule', async () => {
      const res = await getPrConfigDescription(config);
      expect(res).toContain(`At any time (no schedule defined).`);
    });

    it('renders recreateClosed', async () => {
      const res = await getPrConfigDescription({
        ...config,
        recreateClosed: true,
      });
      expect(res).toContain(`**Immortal**`);
    });

    it('renders singular', async () => {
      const res = await getPrConfigDescription({
        ...config,
        upgrades: [config],
      });
      expect(res).toContain(`this update`);
    });

    it('renders failed automerge', async () => {
      checks.resolveBranchStatus.mockResolvedValueOnce(BranchStatus.red);
      const res = await getPrConfigDescription({ ...config, automerge: true });
      expect(res).toContain(`Disabled due to failing status checks`);
    });

    it('renders automerge', async () => {
      checks.resolveBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      const res = await getPrConfigDescription({ ...config, automerge: true });
      expect(res).toContain(`**Automerge**: Enabled.`);
    });
  });
});
