import type { RenovateConfig } from '~test/util.ts';
import { partial } from '~test/util.ts';
import type { BranchConfig } from '../../../types.ts';
import { getExpectedPrList } from './pr-list.ts';

describe('workers/repository/onboarding/pr/pr-list', () => {
  describe('getExpectedPrList()', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      config = partial<RenovateConfig>({
        prHourlyLimit: 2, // default
      });
    });

    it('handles empty', () => {
      const branches: BranchConfig[] = [];
      const res = getExpectedPrList(config, branches);
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
      const res = getExpectedPrList(config, branches);
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
      const res = getExpectedPrList(config, branches);
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



        🚸 PR creation will be limited to maximum 1 per hour, so it doesn't swamp any CI resources or overwhelm the project. See docs for \`prHourlyLimit\` for details.

        "
      `);
    });

    it('shows commitHourlyLimit message when limit is low', () => {
      const branches: BranchConfig[] = [
        {
          prTitle: 'Update a to v1',
          branchName: 'renovate/a-1.x',
          baseBranch: 'base',
          manager: 'some-manager',
          upgrades: [
            {
              manager: 'some-manager',
              depName: 'a',
              newValue: '1.0.0',
              branchName: 'some-branch',
            },
          ],
        },
        {
          prTitle: 'Update b to v1',
          branchName: 'renovate/b-1.x',
          baseBranch: 'base',
          manager: 'some-manager',
          upgrades: [
            {
              manager: 'some-manager',
              depName: 'b',
              newValue: '1.0.0',
              branchName: 'some-branch',
            },
          ],
        },
      ];
      config.commitHourlyLimit = 1;
      const res = getExpectedPrList(config, branches);
      expect(res).toContain(
        'Branch creation and rebasing will be limited to maximum 1 per hour',
      );
      expect(res).toContain('commitHourlyLimit');
    });

    it('does not show commitHourlyLimit message when limit is high', () => {
      const branches: BranchConfig[] = [
        {
          prTitle: 'Update a to v1',
          branchName: 'renovate/a-1.x',
          baseBranch: 'base',
          manager: 'some-manager',
          upgrades: [
            {
              manager: 'some-manager',
              depName: 'a',
              newValue: '1.0.0',
              branchName: 'some-branch',
            },
          ],
        },
      ];
      config.commitHourlyLimit = 10;
      const res = getExpectedPrList(config, branches);
      expect(res).not.toContain('commitHourlyLimit');
    });

    it('shows only commitHourlyLimit message when both limits are set', () => {
      const branches: BranchConfig[] = [
        {
          prTitle: 'Update a to v1',
          branchName: 'renovate/a-1.x',
          baseBranch: 'base',
          manager: 'some-manager',
          upgrades: [
            {
              manager: 'some-manager',
              depName: 'a',
              newValue: '1.0.0',
              branchName: 'some-branch',
            },
          ],
        },
        {
          prTitle: 'Update b to v1',
          branchName: 'renovate/b-1.x',
          baseBranch: 'base',
          manager: 'some-manager',
          upgrades: [
            {
              manager: 'some-manager',
              depName: 'b',
              newValue: '1.0.0',
              branchName: 'some-branch',
            },
          ],
        },
      ];
      config.prHourlyLimit = 1;
      config.commitHourlyLimit = 1;
      const res = getExpectedPrList(config, branches);
      expect(res).toContain('commitHourlyLimit');
      expect(res).not.toContain('prHourlyLimit');
    });
  });
});
