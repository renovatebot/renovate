import type { RenovateConfig } from '~test/util.ts';
import { partial } from '~test/util.ts';
import type { BranchConfig } from '../../../types.ts';
import { getExpectedPrList, getExpectedPrListSummary } from './pr-list.ts';

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



        🚸 PR creation will be limited to maximum 1 per hour, so it doesn't swamp any CI resources or overwhelm the project. See [docs for \`prHourlyLimit\`](https://docs.renovatebot.com/configuration-options/#prhourlylimit) for details.

        "
      `);
    });

    it('deduplicates identical upgrade lines within a branch', () => {
      const branches: BranchConfig[] = [
        {
          prTitle: 'Update a',
          branchName: 'renovate/a',
          baseBranch: 'base',
          manager: 'some-manager',
          upgrades: [
            {
              manager: 'some-manager',
              updateType: 'minor',
              depName: 'a',
              newValue: '1.1.0',
              branchName: 'ignored',
            },
            {
              manager: 'some-manager',
              updateType: 'minor',
              depName: 'a',
              newValue: '1.1.0',
              branchName: 'ignored',
            },
          ],
        },
      ];
      const res = getExpectedPrList(config, branches);
      expect(res.match(/Upgrade a to/g)).toHaveLength(1);
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

  describe('getExpectedPrListSummary()', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      config = partial<RenovateConfig>({
        prHourlyLimit: 2, // default
      });
    });

    it('handles empty', () => {
      const branches: BranchConfig[] = [];
      const res = getExpectedPrListSummary(config, branches);
      expect(res).toMatchInlineSnapshot(`
        "
        ### What to Expect

        It looks like your repository dependencies are already up-to-date and no Pull Requests will be necessary right away.
        "
      `);
    });

    it('handles different updateTypes', () => {
      const branches: BranchConfig[] = [
        {
          prTitle: 'Pin dependencies',
          baseBranch: '',
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
          baseBranch: '',
          manager: 'some-manager',
          upgrades: [
            {
              updateType: 'major',
              manager: 'some-manager',
              sourceUrl: 'https://a',
              depName: 'a',
              currentValue: '^1.0.0',
              depType: 'devDependencies',
              newValue: '2.0.1',
              isLockfileUpdate: true,
              branchName: 'ignored',
            },
          ],
        },
        {
          prTitle: 'Replace node with nodejs',
          branchName: 'renovate/node-replacement',
          baseBranch: '',
          manager: 'dockerfile',
          upgrades: [
            {
              manager: 'dockerfile',
              updateType: 'replacement',
              depName: 'a',
              currentValue: '^1.0.0',
              branchName: 'ignored',
            },
          ],
        },
      ];

      const res = getExpectedPrListSummary(config, branches);

      expect(res).toMatchInlineSnapshot(`
        "
        ### What to Expect

        With your current configuration, Renovate will create 3 Pull Requests (at a maximum of 2 PRs per hour):

        | Manager | major | pin | replacement |
        | --- | --- | --- | --- |
        | some-manager | 1 | 1 | 0 |
        | dockerfile | 0 | 0 | 1 |
        | **Total** | 1 | 1 | 1 |

        <small>Note that a single PR can update multiple files and/or managers, so the above rows may not align with the number of PRs being listed above.</small>


        🚸 PR creation will be limited to maximum 2 per hour, so it doesn't swamp any CI resources or overwhelm the project. See [docs for \`prHourlyLimit\`](https://docs.renovatebot.com/configuration-options/#prhourlylimit) for details.

        "
      `);
    });

    it('handles lockFileMaintenance', () => {
      const branches: BranchConfig[] = [
        {
          prTitle: 'Lock file maintenance',
          schedule: ['before 5am'],
          branchName: 'renovate/lock-file-maintenance',
          baseBranch: 'base',
          manager: 'some-manager',
          packageFile: 'package.json',
          upgrades: [
            {
              manager: 'some-manager',
              updateType: 'lockFileMaintenance',
              branchName: 'ignored',
            },
          ],
        },
      ];
      const res = getExpectedPrListSummary(config, branches);
      expect(res).toMatchInlineSnapshot(`
        "
        ### What to Expect

        With your current configuration, Renovate will create 1 Pull Request:

        | Manager | lockFileMaintenance |
        | --- | --- |
        | some-manager | 1 |
        | **Total** | 1 |

        <small>Note that a single PR can update multiple files and/or managers, so the above rows may not align with the number of PRs being listed above.</small>
        "
      `);
    });

    it('does not show schedule information', () => {
      const branches: BranchConfig[] = [
        {
          prTitle: 'Lock file maintenance',
          schedule: ['before 5am on Monday'],
          branchName: 'renovate/lock-file-maintenance',
          baseBranch: '',
          manager: 'some-manager',
          upgrades: [
            {
              manager: 'some-manager',
              updateType: 'lockFileMaintenance',
              branchName: 'ignored',
            },
          ],
        },
        {
          prTitle: 'Update a to v2',
          schedule: ['every weekend'],
          branchName: 'renovate/a-2.x',
          baseBranch: '',
          manager: 'some-manager',
          upgrades: [
            {
              manager: 'some-manager',
              updateType: 'minor',
              depName: 'a',
              newValue: '2.0.0',
              branchName: 'ignored',
            },
          ],
        },
      ];
      const res = getExpectedPrListSummary(config, branches);
      expect(res).not.toContain('before 5am');
      expect(res).not.toContain('every weekend');
      expect(res).not.toContain('Schedule');
    });

    it('includes the base branch if there are multiple being tracked', () => {
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
              branchName: 'ignored',
            },
            {
              manager: 'some-manager',
              updateType: 'pin',
              depName: 'b',
              newValue: '1.5.3',
              branchName: 'ignored',
            },
          ],
        },
        {
          prTitle: 'Update a to v2',
          branchName: 'renovate/a-2.x',
          baseBranch: '', // the default branch
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
              branchName: 'ignored',
            },
          ],
        },
      ];

      const res = getExpectedPrListSummary(config, branches);

      expect(res).toMatchInlineSnapshot(`
        "
        ### What to Expect

        With your current configuration, Renovate will create 1 Pull Request to the default branch and 1 Pull Request to the \`base\` branch:

        | Branch | Manager | pin | lockfileUpdate |
        | --- | --- | --- | --- |
        | $default | some-manager | 0 | 1 |
        | base | some-manager | 1 | 0 |
        | **Total** |  | 1 | 1 |

        <small>Note that a single PR can update multiple files and/or managers, so the above rows may not align with the number of PRs being listed above.</small>
        "
      `);
    });

    it('includes the limits when using multiple base branches', () => {
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
              branchName: 'ignored',
            },
            {
              manager: 'some-manager',
              updateType: 'pin',
              depName: 'b',
              newValue: '1.5.3',
              branchName: 'ignored',
            },
          ],
        },
        {
          prTitle: 'Update b to v2',
          branchName: 'renovate/b-2.x',
          baseBranch: '',
          manager: 'some-manager',
          upgrades: [
            {
              manager: 'some-manager',
              updateType: 'minor',
              depName: 'b',
              newValue: '2.0.0',
              branchName: 'ignored',
            },
          ],
        },
        {
          prTitle: 'Update a to v2',
          branchName: 'renovate/a-2.x',
          baseBranch: '', // the default branch
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
              branchName: 'ignored',
            },
          ],
        },
      ];

      config.commitHourlyLimit = 1;
      config.prHourlyLimit = 1;

      const res = getExpectedPrListSummary(config, branches);

      expect(res).toMatchInlineSnapshot(`
        "
        ### What to Expect

        With your current configuration, Renovate will create 2 Pull Requests to the default branch and 1 Pull Request to the \`base\` branch (at a maximum of 1 PR/rebase per hour):

        | Branch | Manager | minor | pin | lockfileUpdate |
        | --- | --- | --- | --- | --- |
        | $default | some-manager | 1 | 0 | 1 |
        | base | some-manager | 0 | 1 | 0 |
        | **Total** |  | 1 | 1 | 1 |

        <small>Note that a single PR can update multiple files and/or managers, so the above rows may not align with the number of PRs being listed above.</small>


        🚸 Branch creation and rebasing will be limited to maximum 1 per hour, so it doesn't swamp any CI resources or overwhelm the project. See [docs for \`commitHourlyLimit\`](https://docs.renovatebot.com/configuration-options/#commithourlylimit) for details.

        "
      `);
    });

    it('sorts multiple named base branches alphabetically after the default branch', () => {
      const branches: BranchConfig[] = [
        {
          prTitle: 'Update a to v2',
          branchName: 'renovate/a-2.x',
          baseBranch: '',
          manager: 'some-manager',
          upgrades: [
            {
              manager: 'some-manager',
              updateType: 'minor',
              depName: 'a',
              newValue: '2.0.0',
              branchName: 'ignored',
            },
          ],
        },
        {
          prTitle: 'Pin b',
          branchName: 'renovate/pin-b',
          baseBranch: 'beta-branch',
          manager: 'some-manager',
          upgrades: [
            {
              manager: 'some-manager',
              updateType: 'pin',
              depName: 'b',
              newValue: '1.0.0',
              branchName: 'ignored',
            },
          ],
        },
        {
          prTitle: 'Pin c',
          branchName: 'renovate/pin-c',
          baseBranch: 'alpha-branch',
          manager: 'some-manager',
          upgrades: [
            {
              manager: 'some-manager',
              updateType: 'pin',
              depName: 'c',
              newValue: '1.0.0',
              branchName: 'ignored',
            },
          ],
        },
      ];
      config.prHourlyLimit = 10;
      const res = getExpectedPrListSummary(config, branches);
      expect(res).toMatchInlineSnapshot(`
        "
        ### What to Expect

        With your current configuration, Renovate will create 1 Pull Request to the default branch and 1 Pull Request to the \`alpha-branch\` branch and 1 Pull Request to the \`beta-branch\` branch:

        | Branch | Manager | minor | pin |
        | --- | --- | --- | --- |
        | $default | some-manager | 1 | 0 |
        | alpha-branch | some-manager | 0 | 1 |
        | beta-branch | some-manager | 0 | 1 |
        | **Total** |  | 1 | 2 |

        <small>Note that a single PR can update multiple files and/or managers, so the above rows may not align with the number of PRs being listed above.</small>
        "
      `);
    });

    it('uses the plural form when a base branch has multiple PRs', () => {
      const branches: BranchConfig[] = [
        {
          prTitle: 'Pin a',
          branchName: 'renovate/pin-a',
          baseBranch: 'base',
          manager: 'some-manager',
          upgrades: [
            {
              manager: 'some-manager',
              updateType: 'pin',
              depName: 'a',
              newValue: '1.0.0',
              branchName: 'ignored',
            },
          ],
        },
        {
          prTitle: 'Pin b',
          branchName: 'renovate/pin-b',
          baseBranch: 'base',
          manager: 'some-manager',
          upgrades: [
            {
              manager: 'some-manager',
              updateType: 'pin',
              depName: 'b',
              newValue: '1.0.0',
              branchName: 'ignored',
            },
          ],
        },
        {
          prTitle: 'Pin c',
          branchName: 'renovate/pin-c',
          baseBranch: '',
          manager: 'some-manager',
          upgrades: [
            {
              manager: 'some-manager',
              updateType: 'pin',
              depName: 'c',
              newValue: '1.0.0',
              branchName: 'ignored',
            },
          ],
        },
      ];
      const res = getExpectedPrListSummary(config, branches);
      expect(res).toContain(
        '1 Pull Request to the default branch and 2 Pull Requests to the `base` branch',
      );
    });

    it('treats branches without a baseBranch as the default branch', () => {
      const branches: BranchConfig[] = [
        partial<BranchConfig>({
          prTitle: 'Pin a',
          branchName: 'renovate/pin-a',
          manager: 'some-manager',
          upgrades: [
            {
              manager: 'some-manager',
              updateType: 'pin',
              depName: 'a',
              newValue: '1.0.0',
              branchName: 'ignored',
            },
          ],
        }),
      ];
      const res = getExpectedPrListSummary(config, branches);
      expect(res).toContain('1 Pull Request:');
      // single base => no per-branch column in the table
      expect(res).not.toContain('| Branch |');
    });

    it('handles uncommon types of updates as other', () => {
      const branches: BranchConfig[] = [
        {
          prTitle: 'Update a to v2',
          branchName: 'renovate/a-2.x',
          baseBranch: '',
          manager: 'another-manager',
          upgrades: [
            {
              manager: 'some-manager',
              sourceUrl: 'https://a',
              depName: 'a',
              currentValue: '^1.0.0',
              depType: 'devDependencies',
              newValue: '2.0.1',
              branchName: 'ignored',
              isRemediation: true,
            },
            // although bump is less common, it's a valid `UpdateType`, so is its own column
            {
              manager: 'some-manager',
              sourceUrl: 'https://a',
              depName: 'a',
              currentValue: '^1.0.0',
              depType: 'devDependencies',
              newValue: '2.0.1',
              branchName: 'ignored',
              updateType: 'bump',
            },
          ],
        },
      ];
      config.prHourlyLimit = 1;
      const res = getExpectedPrListSummary(config, branches);
      expect(res).toMatchInlineSnapshot(`
        "
        ### What to Expect

        With your current configuration, Renovate will create 1 Pull Request:

        | Manager | bump | other |
        | --- | --- | --- |
        | another-manager | 1 | 1 |
        | **Total** | 1 | 1 |

        <small>Note that a single PR can update multiple files and/or managers, so the above rows may not align with the number of PRs being listed above.</small>
        "
      `);
    });

    it('handles updates with a different number of dependencies being updated', () => {
      const branches: BranchConfig[] = [
        {
          prTitle: 'Pin dependencies',
          baseBranch: '',
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
              branchName: 'ignored',
            },
            {
              manager: 'some-manager',
              updateType: 'pin',
              depName: 'b',
              newValue: '1.5.3',
              branchName: 'ignored',
            },
          ],
        },
        {
          prTitle: 'Update a to v2',
          branchName: 'renovate/a-2.x',
          baseBranch: '',
          manager: 'another-manager',
          upgrades: [
            {
              manager: 'some-manager',
              sourceUrl: 'https://a',
              depName: 'a',
              currentValue: '^1.0.0',
              depType: 'devDependencies',
              newValue: '2.0.1',
              isLockfileUpdate: true,
              branchName: 'ignored',
            },
            {
              manager: 'some-manager',
              sourceUrl: 'https://a',
              depName: 'a',
              currentValue: '^1.0.0',
              depType: 'devDependencies',
              newValue: '2.0.1',
              branchName: 'ignored',
              isRemediation: true, // will get classified as 'other' update type
            },
          ],
        },
      ];
      config.prHourlyLimit = 1;
      const res = getExpectedPrListSummary(config, branches);
      expect(res).toMatchInlineSnapshot(`
        "
        ### What to Expect

        With your current configuration, Renovate will create 2 Pull Requests (at a maximum of 1 PR per hour):

        | Manager | pin | lockfileUpdate | other |
        | --- | --- | --- | --- |
        | some-manager | 1 | 0 | 0 |
        | another-manager | 0 | 1 | 1 |
        | **Total** | 1 | 1 | 1 |

        <small>Note that a single PR can update multiple files and/or managers, so the above rows may not align with the number of PRs being listed above.</small>


        🚸 PR creation will be limited to maximum 1 per hour, so it doesn't swamp any CI resources or overwhelm the project. See [docs for \`prHourlyLimit\`](https://docs.renovatebot.com/configuration-options/#prhourlylimit) for details.

        "
      `);
    });

    it('handles many different updateTypes', () => {
      const branches: BranchConfig[] = [
        {
          prTitle: 'Pin dependencies',
          baseBranch: '',
          branchName: 'renovate/pin-dependencies',
          manager: 'some-manager',
          upgrades: [
            {
              manager: 'some-manager',
              updateType: 'pin',
              depName: 'a',
              newValue: '1.1.0',
              branchName: 'ignored',
            },
            {
              manager: 'some-manager',
              updateType: 'pin',
              depName: 'b',
              newValue: '1.2.0',
              branchName: 'ignored',
            },
          ],
        },
        {
          prTitle: 'Update a to v2',
          branchName: 'renovate/a-2.x',
          baseBranch: '',
          manager: 'another-manager',
          upgrades: [
            {
              manager: 'some-manager',
              updateType: 'major',
              depName: 'a',
              newValue: '2.0.1',
              branchName: 'ignored',
            },
          ],
        },
        {
          prTitle: 'Update a to 1.3.0',
          branchName: 'renovate/a-1.3',
          baseBranch: '',
          manager: 'some-manager',
          upgrades: [
            {
              manager: 'some-manager',
              updateType: 'minor',
              depName: 'a',
              newValue: '1.3.0',
              branchName: 'ignored',
            },
          ],
        },
        {
          prTitle: 'Update a to 1.1.1',
          branchName: 'renovate/a-1.1',
          baseBranch: '',
          manager: 'some-manager',
          upgrades: [
            {
              manager: 'some-manager',
              updateType: 'patch',
              depName: 'a',
              newValue: '1.1.1',
              branchName: 'ignored',
            },
          ],
        },
      ];
      config.prHourlyLimit = 1;
      const res = getExpectedPrListSummary(config, branches);
      expect(res).toMatchInlineSnapshot(`
        "
        ### What to Expect

        With your current configuration, Renovate will create 4 Pull Requests (at a maximum of 1 PR per hour):

        | Manager | major | minor | patch | pin |
        | --- | --- | --- | --- | --- |
        | some-manager | 0 | 1 | 1 | 1 |
        | another-manager | 1 | 0 | 0 | 0 |
        | **Total** | 1 | 1 | 1 | 1 |

        <small>Note that a single PR can update multiple files and/or managers, so the above rows may not align with the number of PRs being listed above.</small>


        🚸 PR creation will be limited to maximum 1 per hour, so it doesn't swamp any CI resources or overwhelm the project. See [docs for \`prHourlyLimit\`](https://docs.renovatebot.com/configuration-options/#prhourlylimit) for details.

        "
      `);
    });

    describe('has special description when security update(s) exist', () => {
      it('and are split over multiple lines if there are multiple package files', () => {
        const branches: BranchConfig[] = [
          {
            prTitle: 'Update a to v2',
            branchName: 'renovate/a-2.x',
            baseBranch: '',
            manager: 'another-manager',
            packageFile: 'package.json',
            isVulnerabilityAlert: true,
            upgrades: [
              {
                manager: 'some-manager',
                updateType: 'major',
                depName: 'a',
                newValue: '2.0.1',
                branchName: 'ignored',
              },
            ],
          },
          {
            prTitle: 'Update a to 1.3.0',
            branchName: 'renovate/a-1.3',
            baseBranch: '',
            manager: 'some-manager',
            packageFile: 'packages/examples/foo.json',
            isVulnerabilityAlert: true,
            upgrades: [
              {
                manager: 'some-manager',
                updateType: 'minor',
                depName: 'a',
                newValue: '1.3.0',
                branchName: 'ignored',
              },
            ],
          },

          // multiple updates to the same file are grouped
          {
            prTitle: 'Update a to 1.1.1',
            branchName: 'renovate/a-1.1',
            baseBranch: '',
            manager: 'some-manager',
            isVulnerabilityAlert: true,
            packageFile: 'packages/examples/blah.json',
            upgrades: [
              {
                manager: 'some-manager',
                updateType: 'patch',
                depName: 'a',
                newValue: '1.1.1',
                branchName: 'ignored',
              },
            ],
          },
          {
            prTitle: 'Update a to 1.1.1',
            branchName: 'renovate/a-1.1',
            baseBranch: '',
            manager: 'some-manager',
            isVulnerabilityAlert: true,
            packageFile: 'packages/examples/another.json',
            upgrades: [
              {
                manager: 'some-manager',
                updateType: 'patch',
                depName: 'a',
                newValue: '1.1.1',
                branchName: 'ignored',
              },
            ],
          },
        ];
        const res = getExpectedPrListSummary(config, branches);
        expect(res).toMatchInlineSnapshot(`
          "
          ### What to Expect

          With your current configuration, Renovate will create 3 Pull Requests (at a maximum of 2 PRs per hour):

          | Manager | security |
          | --- | --- |
          | another-manager | 1 |
          | some-manager | 2 |
          | **Total** | 3 |

          <small>Note that a single PR can update multiple files and/or managers, so the above rows may not align with the number of PRs being listed above.</small>

          **Security updates**:

          - \`a\`, (another-manager, major): \`package.json\`
          - \`a\`, (some-manager, minor): \`packages/examples/foo.json\`
          - \`a\`, (some-manager, patch):
            - \`packages/examples/blah.json\`
            - \`packages/examples/another.json\`


          🚸 PR creation will be limited to maximum 2 per hour, so it doesn't swamp any CI resources or overwhelm the project. See [docs for \`prHourlyLimit\`](https://docs.renovatebot.com/configuration-options/#prhourlylimit) for details.

          "
        `);
      });

      it('when the same package is updated across different files with different managers', () => {
        const branches: BranchConfig[] = [
          {
            prTitle: 'Update c to 1.1.1',
            branchName: 'renovate/c-1.1',
            baseBranch: '',
            manager: 'pip_requirements',
            isVulnerabilityAlert: true,
            packageFile: 'requirements.txt',
            upgrades: [
              {
                manager: 'pip_requirements',
                updateType: 'patch',
                depName: 'c',
                newValue: '1.1.1',
                branchName: 'ignored',
              },
            ],
          },
          {
            prTitle: 'Update c to 1.1.1',
            branchName: 'renovate/c-1.1',
            baseBranch: '',
            manager: 'pep621',
            isVulnerabilityAlert: true,
            packageFile: 'pyproject.toml',
            upgrades: [
              {
                manager: 'some-manager',
                updateType: 'patch',
                depName: 'c',
                newValue: '1.1.1',
                branchName: 'ignored',
              },
            ],
          },
        ];
        const res = getExpectedPrListSummary(config, branches);
        expect(res).toMatchInlineSnapshot(`
          "
          ### What to Expect

          With your current configuration, Renovate will create 1 Pull Request:

          | Manager | security |
          | --- | --- |
          | pip_requirements | 1 |
          | pep621 | 1 |
          | **Total** | 2 |

          <small>Note that a single PR can update multiple files and/or managers, so the above rows may not align with the number of PRs being listed above.</small>

          **Security updates**:

          - \`c\`, (patch):
            - \`requirements.txt\` (pip_requirements)
            - \`pyproject.toml\` (pep621)
          "
        `);
      });

      it('falls back to prTitle when the first upgrade has no depName', () => {
        const branches: BranchConfig[] = [
          {
            prTitle: 'Update something',
            branchName: 'renovate/something',
            baseBranch: '',
            manager: 'some-manager',
            packageFile: 'package.json',
            isVulnerabilityAlert: true,
            upgrades: [
              {
                manager: 'some-manager',
                updateType: 'patch',
                newValue: '1.0.0',
                branchName: 'ignored',
              },
            ],
          },
        ];
        const res = getExpectedPrListSummary(config, branches);
        expect(res).toContain(
          '`Update something`, (some-manager, patch): `package.json`',
        );
      });

      it('falls back to "unknown" when the first upgrade has no updateType', () => {
        const branches: BranchConfig[] = [
          {
            prTitle: 'Update a',
            branchName: 'renovate/a',
            baseBranch: '',
            manager: 'some-manager',
            packageFile: 'package.json',
            isVulnerabilityAlert: true,
            upgrades: [
              {
                manager: 'some-manager',
                depName: 'a',
                newValue: '1.0.0',
                branchName: 'ignored',
              },
            ],
          },
        ];
        const res = getExpectedPrListSummary(config, branches);
        expect(res).toContain('`a`, (some-manager, unknown): `package.json`');
      });

      it('falls back to empty when neither depName nor prTitle are set', () => {
        const branches: BranchConfig[] = [
          partial<BranchConfig>({
            branchName: 'renovate/a',
            baseBranch: '',
            manager: 'some-manager',
            packageFile: 'package.json',
            isVulnerabilityAlert: true,
            upgrades: [
              {
                manager: 'some-manager',
                updateType: 'patch',
                newValue: '1.0.0',
                branchName: 'ignored',
              },
            ],
          }),
        ];
        const res = getExpectedPrListSummary(config, branches);
        expect(res).toContain('``, (some-manager, patch): `package.json`');
      });

      // for instance, if a GitHub vulnerability alert is triggered, it's based on the datasource+packageName, not the packageFile
      describe('handles when the packageFile is not set', () => {
        it('on one upgrade', () => {
          const branches: BranchConfig[] = [
            {
              prTitle: 'Update a to 1.1.1',
              branchName: 'renovate/a-1.1',
              baseBranch: '',
              manager: 'some-manager',
              // no packageFile
              isVulnerabilityAlert: true,
              upgrades: [
                {
                  manager: 'some-manager',
                  updateType: 'patch',
                  depName: 'a',
                  newValue: '1.1.1',
                  branchName: 'ignored',
                },
              ],
            },
          ];
          const res = getExpectedPrListSummary(config, branches);
          expect(res).toMatchInlineSnapshot(`
            "
            ### What to Expect

            With your current configuration, Renovate will create 1 Pull Request:

            | Manager | security |
            | --- | --- |
            | some-manager | 1 |
            | **Total** | 1 |

            <small>Note that a single PR can update multiple files and/or managers, so the above rows may not align with the number of PRs being listed above.</small>

            **Security updates**:

            - \`a\`, (some-manager, patch)
            "
          `);
        });

        it('on one upgrade, and an upgrade with a packageFile', () => {
          const branches: BranchConfig[] = [
            {
              prTitle: 'Update a to 1.1.1',
              branchName: 'renovate/a-1.1',
              baseBranch: '',
              manager: 'some-manager',
              // no packageFile
              isVulnerabilityAlert: true,
              upgrades: [
                {
                  manager: 'some-manager',
                  updateType: 'patch',
                  depName: 'a',
                  newValue: '1.1.1',
                  branchName: 'ignored',
                },
              ],
            },
            {
              prTitle: 'Update c to 1.1.1',
              branchName: 'renovate/c-1.1',
              baseBranch: '',
              manager: 'pep621',
              isVulnerabilityAlert: true,
              packageFile: 'pyproject.toml',
              upgrades: [
                {
                  manager: 'some-manager',
                  updateType: 'patch',
                  depName: 'c',
                  newValue: '1.1.1',
                  branchName: 'ignored',
                },
              ],
            },
          ];
          const res = getExpectedPrListSummary(config, branches);
          expect(res).toMatchInlineSnapshot(`
            "
            ### What to Expect

            With your current configuration, Renovate will create 2 Pull Requests:

            | Manager | security |
            | --- | --- |
            | some-manager | 1 |
            | pep621 | 1 |
            | **Total** | 2 |

            <small>Note that a single PR can update multiple files and/or managers, so the above rows may not align with the number of PRs being listed above.</small>

            **Security updates**:

            - \`a\`, (some-manager, patch)
            - \`c\`, (pep621, patch): \`pyproject.toml\`
            "
          `);
        });

        it('across multiple branches with different managers, lists all managers', () => {
          const branches: BranchConfig[] = [
            {
              prTitle: 'Update a to 1.1.1',
              branchName: 'renovate/a-1.1',
              baseBranch: '',
              manager: 'some-manager',
              isVulnerabilityAlert: true,
              upgrades: [
                {
                  manager: 'some-manager',
                  updateType: 'patch',
                  depName: 'a',
                  newValue: '1.1.1',
                  branchName: 'some-branch',
                },
              ],
            },
            {
              prTitle: 'Update a to 1.1.1',
              branchName: 'renovate/a-1.1',
              baseBranch: '',
              manager: 'another-manager',
              isVulnerabilityAlert: true,
              upgrades: [
                {
                  manager: 'another-manager',
                  updateType: 'patch',
                  depName: 'a',
                  newValue: '1.1.1',
                  branchName: 'some-branch',
                },
              ],
            },
          ];
          const res = getExpectedPrListSummary(config, branches);
          expect(res).toMatchInlineSnapshot(`
            "
            ### What to Expect

            With your current configuration, Renovate will create 1 Pull Request:

            | Manager | security |
            | --- | --- |
            | some-manager | 1 |
            | another-manager | 1 |
            | **Total** | 2 |

            <small>Note that a single PR can update multiple files and/or managers, so the above rows may not align with the number of PRs being listed above.</small>

            **Security updates**:

            - \`a\`, (patch): another-manager, some-manager
            "
          `);
        });
      });
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
              branchName: 'ignored',
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
              branchName: 'ignored',
            },
          ],
        },
      ];
      config.commitHourlyLimit = 1;
      const res = getExpectedPrListSummary(config, branches);
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
              branchName: 'ignored',
            },
          ],
        },
      ];
      config.commitHourlyLimit = 10;
      const res = getExpectedPrListSummary(config, branches);
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
              branchName: 'ignored',
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
              branchName: 'ignored',
            },
          ],
        },
      ];
      config.prHourlyLimit = 1;
      config.commitHourlyLimit = 1;
      const res = getExpectedPrListSummary(config, branches);
      expect(res).toContain('commitHourlyLimit');
      expect(res).not.toContain('prHourlyLimit');
    });

    it('shows commitHourlyLimit message with plurals when limit is greater than 1', () => {
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
              branchName: 'ignored',
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
              branchName: 'ignored',
            },
          ],
        },
        {
          prTitle: 'Update c to v1',
          branchName: 'renovate/c-1.x',
          baseBranch: 'base',
          manager: 'some-manager',
          upgrades: [
            {
              manager: 'some-manager',
              depName: 'c',
              newValue: '1.0.0',
              branchName: 'ignored',
            },
          ],
        },
      ];
      config.commitHourlyLimit = 2;
      const res = getExpectedPrListSummary(config, branches);
      expect(res).toContain('at a maximum of 2 PRs');
      expect(res).toContain('rebases per hour');
    });

    it('shows there is no limit when both commitHourlyLimit and prHourlyLimit are set to 0 (unlimited)', () => {
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
              branchName: 'ignored',
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
              branchName: 'ignored',
            },
          ],
        },
      ];
      config.prHourlyLimit = 0;
      config.commitHourlyLimit = 0;
      const res = getExpectedPrListSummary(config, branches);
      expect(res).toContain('(with no configured maximum of PRs per hour)');
    });
  });
});
