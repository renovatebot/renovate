import { RenovateConfig, partial } from '../../../../../test/util';
import type { BranchConfig } from '../../../types';
import { getPrList } from './pr-list';

describe('workers/repository/onboarding/pr/pr-list', () => {
  describe('getPrList()', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      jest.resetAllMocks();
      config = partial<RenovateConfig>({
        prHourlyLimit: 2, // default
      });
    });

    it('handles empty', () => {
      const branches: BranchConfig[] = [];
      const res = getPrList(config, branches);
      expect(res).toMatchInlineSnapshot(`
        "
        ### What to Expect

        It looks like your repository dependencies are already up-to-date and no Pull Requests will be necessary right away.
        "
      `);
    });

    it('has special lock file maintenance description', () => {
      const branches: BranchConfig[] = [
        {
          prTitle: 'Lock file maintenance',
          schedule: ['before 5am'],
          branchName: 'renovate/lock-file-maintenance',
          baseBranch: 'base',
          manager: 'some-manager',
          upgrades: [
            {
              manager: 'some-manager',
              updateType: 'lockFileMaintenance',
              branchName: 'some-branch',
            },
          ],
        },
      ];
      const res = getPrList(config, branches);
      expect(res).toMatchInlineSnapshot(`
        "
        ### What to Expect

        With your current configuration, Renovate will create 1 Pull Request:

        <details>
        <summary>Lock file maintenance</summary>

          - Schedule: ["before 5am"]
          - Branch name: \`renovate/lock-file-maintenance\`
          - Merge into: \`base\`
          - Regenerate lock files to use latest dependency versions

        </details>

        "
      `);
    });

    it('handles multiple', () => {
      const branches: BranchConfig[] = [
        {
          prTitle: 'Pin dependencies',
          baseBranch: 'base',
          branchName: 'renovate/pin-dependencies',
          manager: 'some-manager',
          upgrades: [
            {
              manager: 'some-manager',
              updateType: 'pin',
              sourceUrl: 'https://a',
              depName: 'a',
              depType: 'devDependencies',
              newValue: '1.1.0',
            },
            {
              manager: 'some-manager',
              updateType: 'pin',
              depName: 'b',
              newValue: '1.5.3',
            },
          ] as never,
        },
        {
          prTitle: 'Update a to v2',
          branchName: 'renovate/a-2.x',
          baseBranch: '', // handles case where baseBranch name is falsy
          manager: 'some-manager',
          upgrades: [
            {
              manager: 'some-manager',
              sourceUrl: 'https://a',
              depName: 'a',
              currentValue: '^1.0.0',
              depType: 'devDependencies',
              newValue: '2.0.1',
              isLockfileUpdate: true,
              branchName: 'some-branch',
            },
          ],
        },
      ];
      config.prHourlyLimit = 1;
      const res = getPrList(config, branches);
      expect(res).toMatchInlineSnapshot(`
        "
        ### What to Expect

        With your current configuration, Renovate will create 2 Pull Requests:

        <details>
        <summary>Pin dependencies</summary>

          - Branch name: \`renovate/pin-dependencies\`
          - Merge into: \`base\`
          - Pin [a](https://a) to \`1.1.0\`
          - Pin b to \`1.5.3\`


        </details>

        <details>
        <summary>Update a to v2</summary>

          - Branch name: \`renovate/a-2.x\`
          - Upgrade [a](https://a) to \`undefined\`


        </details>

        <br />

        🚸 Branch creation will be limited to maximum 1 per hour, so it doesn't swamp any CI resources or overwhelm the project. See docs for \`prhourlylimit\` for details.

        "
      `);
    });
  });
});
