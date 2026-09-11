import type {
  CategoryGroup,
  FlatGroup,
  ParsedCommit,
} from './module-changelog.ts';
import {
  attributeReleases,
  categoryRank,
  consolidateDependencyBumps,
  dedupeCommits,
  escapeMentions,
  filterHiddenTypes,
  groupByModule,
  parseCommitHeader,
  renderModuleChangelog,
  stripPrReference,
} from './module-changelog.ts';

const types = [
  { type: 'feat', section: 'Features' },
  { type: 'fix', section: 'Bug Fixes' },
  { type: 'refactor', section: 'Code Refactoring' },
];

const repo = 'renovatebot/renovate';

describe('tools/release-notes/module-changelog', () => {
  describe('parseCommitHeader', () => {
    it('parses a scoped type', () => {
      expect(
        parseCommitHeader('fix(manager/gitlabci): support ~latest refs'),
      ).toEqual({
        type: 'fix',
        scope: 'manager/gitlabci',
        subject: 'support ~latest refs',
        breaking: false,
      });
    });

    it('parses an unscoped type', () => {
      expect(parseCommitHeader('docs: add warning')).toEqual({
        type: 'docs',
        scope: undefined,
        subject: 'add warning',
        breaking: false,
      });
    });

    it('parses a breaking-change marker', () => {
      expect(parseCommitHeader('feat(api)!: drop old option')).toEqual({
        type: 'feat',
        scope: 'api',
        subject: 'drop old option',
        breaking: true,
      });
    });

    it('lowercases the type', () => {
      expect(parseCommitHeader('Fix: casing')).toMatchObject({ type: 'fix' });
    });

    it('returns undefined for a merge commit', () => {
      expect(
        parseCommitHeader('Merge pull request #1 from foo/bar'),
      ).toBeUndefined();
    });

    it('returns undefined for a message with no Conventional Commits header', () => {
      expect(parseCommitHeader('bump version')).toBeUndefined();
    });
  });

  describe('categoryRank', () => {
    it('ranks module scopes ahead of everything else', () => {
      expect(categoryRank('versioning/cargo')).toBeLessThan(
        categoryRank('workers/repository'),
      );
      expect(categoryRank('manager/npm')).toBeLessThan(
        categoryRank('workers/repository'),
      );
    });

    it('ranks deps last of the named scopes', () => {
      expect(categoryRank('workers/repository')).toBeLessThan(
        categoryRank('deps'),
      );
    });
  });

  describe('dedupeCommits', () => {
    it('folds exact repeats (same type, scope, subject) and counts them', () => {
      const commits: ParsedCommit[] = [
        {
          type: 'feat',
          scope: undefined,
          subject: 'always set `CI=true` for subprocesses',
        },
        {
          type: 'feat',
          scope: undefined,
          subject: 'always set `CI=true` for subprocesses',
        },
      ];

      expect(dedupeCommits(commits)).toEqual([
        {
          type: 'feat',
          scope: undefined,
          subject: 'always set `CI=true` for subprocesses (×2)',
        },
      ]);
    });

    it('does not fold commits that only share a subject', () => {
      const commits: ParsedCommit[] = [
        { type: 'fix', scope: 'a', subject: 'same subject' },
        { type: 'fix', scope: 'b', subject: 'same subject' },
      ];

      expect(dedupeCommits(commits)).toEqual(commits);
    });
  });

  describe('filterHiddenTypes', () => {
    it('drops test/style/ci/refactor by default', () => {
      const commits: ParsedCommit[] = [
        { type: 'test', scope: 'tools', subject: 'a' },
        { type: 'fix', scope: 'tools', subject: 'b' },
      ];

      expect(filterHiddenTypes(commits)).toEqual([commits[1]]);
    });

    it('keeps a hidden-type commit if it is a breaking change', () => {
      const commits: ParsedCommit[] = [
        {
          type: 'refactor',
          scope: 'tools',
          subject: 'a',
          breaking: true,
        },
      ];

      expect(filterHiddenTypes(commits)).toEqual(commits);
    });

    it('keeps everything when given an empty set', () => {
      const commits: ParsedCommit[] = [
        { type: 'test', scope: 'tools', subject: 'a' },
      ];

      expect(filterHiddenTypes(commits, new Set())).toEqual(commits);
    });
  });

  describe('groupByModule', () => {
    it('nests module scopes under a category group', () => {
      const commits: ParsedCommit[] = [
        { type: 'fix', scope: 'manager/gitlabci', subject: 'a' },
        { type: 'fix', scope: 'manager/npm', subject: 'b' },
      ];
      const labels = new Map([
        ['manager/gitlabci', 'GitLab CI/CD'],
        ['manager/npm', 'npm'],
      ]);

      const groups = groupByModule(commits, types, labels);
      expect(groups).toEqual([
        {
          kind: 'category',
          category: 'manager',
          modules: [
            {
              scope: 'manager/gitlabci',
              label: 'GitLab CI/CD',
              commits: [
                { type: 'fix', scope: 'manager/gitlabci', subject: 'a' },
              ],
            },
            {
              scope: 'manager/npm',
              label: 'npm',
              commits: [{ type: 'fix', scope: 'manager/npm', subject: 'b' }],
            },
          ],
        },
      ]);
    });

    it('normalises a plural category scope into its singular category group', () => {
      const commits: ParsedCommit[] = [
        { type: 'fix', scope: 'managers/npm', subject: 'a' },
      ];
      const labels = new Map([['managers/npm', 'npm']]);

      const [group] = groupByModule(commits, types, labels) as [CategoryGroup];
      expect(group).toMatchObject({ kind: 'category', category: 'manager' });
      expect(group.modules).toEqual([
        {
          scope: 'managers/npm',
          label: 'npm',
          commits: [{ type: 'fix', scope: 'managers/npm', subject: 'a' }],
        },
      ]);
    });

    it('routes a bare category scope into that category as a "General" entry', () => {
      const commits: ParsedCommit[] = [
        { type: 'test', scope: 'datasource', subject: 'replace snapshots' },
      ];

      const [group] = groupByModule(commits, types, new Map()) as [
        CategoryGroup,
      ];
      expect(group).toMatchObject({
        kind: 'category',
        category: 'datasource',
      });
      expect(group.modules).toEqual([
        {
          scope: 'datasource',
          label: 'General',
          commits: [
            { type: 'test', scope: 'datasource', subject: 'replace snapshots' },
          ],
        },
      ]);
    });

    it('sorts modules within a category alphabetically by label', () => {
      const commits: ParsedCommit[] = [
        { type: 'fix', scope: 'versioning/cargo', subject: 'a' },
        { type: 'fix', scope: 'versioning/npm', subject: 'b' },
      ];
      const labels = new Map([
        ['versioning/cargo', 'Cargo'],
        ['versioning/npm', 'npm'],
      ]);

      const [group] = groupByModule(commits, types, labels) as [CategoryGroup];
      expect(group.modules.map((m) => m.label)).toEqual(['Cargo', 'npm']);
    });

    it('groups a bare (non-module) scope as its own flat group, however few commits it has', () => {
      const commits: ParsedCommit[] = [
        { type: 'fix', scope: 'workers/repository', subject: 'a' },
        { type: 'fix', scope: 'tools', subject: 'b' },
      ];

      const groups = groupByModule(commits, types, new Map()) as FlatGroup[];
      expect(groups.map((g) => g.scope)).toEqual([
        'tools',
        'workers/repository',
      ]);
    });

    it('sorts category groups ahead of flat groups', () => {
      const commits: ParsedCommit[] = [
        { type: 'fix', scope: 'workers/repository', subject: 'a' },
        { type: 'fix', scope: 'versioning/cargo', subject: 'b' },
      ];

      const groups = groupByModule(
        commits,
        types,
        new Map([['versioning/cargo', 'Cargo']]),
      );
      expect(groups[0]).toMatchObject({
        kind: 'category',
        category: 'versioning',
      });
      expect(groups[1]).toMatchObject({
        kind: 'flat',
        scope: 'workers/repository',
      });
    });

    it('sorts deps after non-module scopes, and Other last', () => {
      const commits: ParsedCommit[] = [
        { type: 'docs', scope: undefined, subject: 'a' },
        { type: 'chore', scope: 'deps', subject: 'b' },
        { type: 'fix', scope: 'workers/repository', subject: 'c' },
      ];

      const groups = groupByModule(commits, types, new Map()) as FlatGroup[];
      expect(groups.map((g) => g.scope)).toEqual([
        'workers/repository',
        'deps',
        undefined,
      ]);
    });

    it('sorts commits within a group by type priority', () => {
      const commits: ParsedCommit[] = [
        {
          type: 'refactor',
          scope: 'workers/repository',
          subject: 'refactor it',
        },
        { type: 'fix', scope: 'workers/repository', subject: 'fix it' },
      ];

      const [group] = groupByModule(commits, types, new Map()) as [FlatGroup];
      expect(group.commits).toEqual([
        { type: 'fix', scope: 'workers/repository', subject: 'fix it' },
        {
          type: 'refactor',
          scope: 'workers/repository',
          subject: 'refactor it',
        },
      ]);
    });

    it('ranks unknown types after known types', () => {
      const commits: ParsedCommit[] = [
        { type: 'chore', scope: 'tools', subject: 'chore it' },
        { type: 'fix', scope: 'tools', subject: 'fix it' },
      ];

      const [group] = groupByModule(commits, types, new Map()) as [FlatGroup];
      expect(group.commits.map((c) => c.type)).toEqual(['fix', 'chore']);
    });

    it('only folds dependency-shaped commits inside a `deps`-like scope', () => {
      // Regression: a docs commit like "update references to renovatebot/
      // github-action to v46.2.5" is dependency-bump *shaped*, but must not
      // be folded — only COLLAPSED_SCOPES commits go through
      // `consolidateDependencyBumps` at all.
      const commits: ParsedCommit[] = [
        {
          type: 'docs',
          scope: undefined,
          subject: 'update references to renovatebot/github-action to v46.2.5',
        },
        {
          type: 'docs',
          scope: undefined,
          subject: 'update references to renovatebot/github-action to v46.2.4',
        },
      ];

      const [group] = groupByModule(commits, types, new Map()) as [FlatGroup];
      expect(group.commits).toHaveLength(2);
    });

    it('gives a singleton scope its own group rather than folding it into Other', () => {
      // A scope stays scannable on its own — e.g. searching for "Cargo" —
      // even if it only has one commit in this range.
      const commits: ParsedCommit[] = [
        { type: 'fix', scope: 'tools', subject: 'a' },
      ];

      const groups = groupByModule(commits, types, new Map()) as FlatGroup[];
      expect(groups.map((g) => g.scope)).toEqual(['tools']);
    });

    describe('breaking changes', () => {
      it('pulls a breaking commit into a leading group, in addition to its normal group', () => {
        const commits: ParsedCommit[] = [
          {
            type: 'feat',
            scope: 'config',
            subject: 'drop old option',
            breaking: true,
          },
          { type: 'fix', scope: 'config', subject: 'other change' },
        ];

        const groups = groupByModule(commits, types, new Map());
        expect(groups[0]).toEqual({
          kind: 'breaking',
          commits: [commits[0]],
        });

        const configGroup = groups.find(
          (g) => g.kind === 'flat' && g.scope === 'config',
        ) as FlatGroup;
        expect(configGroup.commits).toHaveLength(2);
      });

      it('omits the breaking group entirely when nothing is breaking', () => {
        const commits: ParsedCommit[] = [
          { type: 'fix', scope: 'config', subject: 'a' },
        ];

        const groups = groupByModule(commits, types, new Map());
        expect(groups.some((g) => g.kind === 'breaking')).toBe(false);
      });
    });
  });

  describe('renderModuleChangelog', () => {
    it('renders a category group as an h3 heading, modules as a list', () => {
      const groups = groupByModule(
        [
          { type: 'fix', scope: 'manager/gitlabci', subject: 'support refs' },
          { type: 'fix', scope: 'manager/npm', subject: 'massage lockstep' },
        ],
        [{ type: 'fix', section: 'Bug Fixes' }],
        new Map([
          ['manager/gitlabci', 'GitLab CI/CD'],
          ['manager/npm', 'npm'],
        ]),
      );

      expect(renderModuleChangelog(groups, repo)).toBe(
        [
          '### manager',
          '',
          '- GitLab CI/CD',
          '  - fix: support refs',
          '- npm',
          '  - fix: massage lockstep',
        ].join('\n'),
      );
    });

    it('renders a flat group as an h3 heading, commits as a list', () => {
      const groups = groupByModule(
        [{ type: 'docs', scope: undefined, subject: 'add warning' }],
        [{ type: 'docs', section: 'Documentation' }],
        new Map(),
      );

      expect(renderModuleChangelog(groups, repo)).toBe(
        ['### Other', '', '- docs: add warning'].join('\n'),
      );
    });

    it('joins multiple groups with a blank line between them', () => {
      const groups = groupByModule(
        [
          { type: 'fix', scope: 'workers/repository', subject: 'a' },
          { type: 'docs', scope: undefined, subject: 'b' },
        ],
        [
          { type: 'fix', section: 'Bug Fixes' },
          { type: 'docs', section: 'Documentation' },
        ],
        new Map(),
      );

      expect(renderModuleChangelog(groups, repo)).toBe(
        [
          '### workers/repository',
          '',
          '- fix: a',
          '',
          '### Other',
          '',
          '- docs: b',
        ].join('\n'),
      );
    });

    it('renders the breaking group first, with scope and type shown inline', () => {
      const groups = groupByModule(
        [
          {
            type: 'feat',
            scope: 'config',
            subject: 'drop old option',
            breaking: true,
          },
          { type: 'fix', scope: 'config', subject: 'other change' },
        ],
        [
          { type: 'feat', section: 'Features' },
          { type: 'fix', section: 'Bug Fixes' },
        ],
        new Map(),
      );

      expect(renderModuleChangelog(groups, repo)).toBe(
        [
          '### Breaking changes',
          '',
          '- `config` feat!: drop old option',
          '',
          '### config',
          '',
          '- feat: drop old option',
          '- fix: other change',
        ].join('\n'),
      );
    });

    it('collapses a `deps` group behind a <details> block', () => {
      const groups = groupByModule(
        [
          { type: 'chore', scope: 'deps', subject: 'update foo' },
          { type: 'build', scope: 'deps', subject: 'update bar' },
        ],
        [
          { type: 'chore', section: 'Miscellaneous Chores' },
          { type: 'build', section: 'Build System' },
        ],
        new Map(),
      );

      expect(renderModuleChangelog(groups, repo)).toBe(
        [
          '### deps',
          '',
          '<details>',
          '<summary>2 updates</summary>',
          '',
          '- chore: update foo',
          '- build: update bar',
          '',
          '</details>',
        ].join('\n'),
      );
    });

    it('counts every folded-in commit in the <summary>, not just the displayed entries', () => {
      const groups = groupByModule(
        [
          {
            type: 'fix',
            scope: 'deps',
            subject:
              'update ghcr.io/renovatebot/base-image docker tag to v13.95.4',
          },
          {
            type: 'fix',
            scope: 'deps',
            subject:
              'update ghcr.io/renovatebot/base-image docker tag to v13.95.5',
          },
          {
            type: 'fix',
            scope: 'deps',
            subject:
              'update ghcr.io/renovatebot/base-image docker tag to v13.95.6',
          },
        ],
        [{ type: 'fix', section: 'Bug Fixes' }],
        new Map(),
      );

      const rendered = renderModuleChangelog(groups, repo);
      expect(rendered).toContain('<summary>3 updates</summary>');
      // Only the final version survives as a displayed entry.
      expect(rendered).toContain(
        '- fix: update ghcr.io/renovatebot/base-image docker tag to v13.95.6 (3 updates)',
      );
      expect(rendered).not.toContain('v13.95.4');
      expect(rendered).not.toContain('v13.95.5');
    });
  });

  describe('consolidateDependencyBumps', () => {
    it('folds repeated bumps of the same dependency into the latest one', () => {
      const commits: ParsedCommit[] = [
        {
          type: 'fix',
          scope: 'deps',
          subject:
            'update ghcr.io/renovatebot/base-image docker tag to v13.95.4 (main) (#45620)',
        },
        {
          type: 'fix',
          scope: 'deps',
          subject:
            'update ghcr.io/renovatebot/base-image docker tag to v13.95.5 (main) (#45625)',
        },
      ];

      expect(consolidateDependencyBumps(commits)).toEqual([
        {
          type: 'fix',
          scope: 'deps',
          subject:
            'update ghcr.io/renovatebot/base-image docker tag to v13.95.5 (2 updates)',
        },
      ]);
    });

    it('keeps a single bump unchanged', () => {
      const commits: ParsedCommit[] = [
        {
          type: 'build',
          scope: 'deps',
          subject: 'update dependency p-map to v7.0.7 (main) (#45678)',
        },
      ];

      expect(consolidateDependencyBumps(commits)).toEqual(commits);
    });

    it('does not fold bumps of different dependencies together', () => {
      const commits: ParsedCommit[] = [
        {
          type: 'build',
          scope: 'deps',
          subject: 'update dependency foo to v1.0.0',
        },
        {
          type: 'build',
          scope: 'deps',
          subject: 'update dependency bar to v2.0.0',
        },
      ];

      expect(consolidateDependencyBumps(commits)).toEqual(commits);
    });

    it('folds bumps of the same dependency across different commit types', () => {
      const commits: ParsedCommit[] = [
        {
          type: 'build',
          scope: 'deps',
          subject: 'update dependency protobufjs to v8.8.0',
        },
        {
          type: 'chore',
          scope: 'deps',
          subject: 'update dependency protobufjs@8.0.1 to v8.9.0',
        },
      ];

      expect(consolidateDependencyBumps(commits)).toEqual([
        {
          type: 'chore',
          scope: 'deps',
          subject: 'update dependency protobufjs@8.0.1 to v8.9.0 (2 updates)',
        },
      ]);
    });

    it('leaves non-dependency-update subjects untouched', () => {
      const commits: ParsedCommit[] = [
        { type: 'chore', scope: 'deps', subject: 'lock file maintenance' },
      ];

      expect(consolidateDependencyBumps(commits)).toEqual(commits);
    });

    it('does not treat a non-version "to X" phrase as a dependency bump', () => {
      const commits: ParsedCommit[] = [
        {
          type: 'docs',
          scope: 'deps',
          subject: 'update docs to mention the new option',
        },
      ];

      expect(consolidateDependencyBumps(commits)).toEqual(commits);
    });

    it('strips a pinned-version suffix from the grouping key', () => {
      const commits: ParsedCommit[] = [
        {
          type: 'chore',
          scope: 'deps',
          subject: 'update dependency protobufjs@8.0.1 to v8.8.0',
        },
        {
          type: 'chore',
          scope: 'deps',
          subject: 'update dependency protobufjs@8.8.0 to v8.9.0',
        },
      ];

      expect(consolidateDependencyBumps(commits)).toEqual([
        {
          type: 'chore',
          scope: 'deps',
          subject: 'update dependency protobufjs@8.8.0 to v8.9.0 (2 updates)',
        },
      ]);
    });
  });

  describe('escapeMentions', () => {
    it('neutralises an npm scoped package name so it cannot be read as a mention', () => {
      expect(escapeMentions('update dependency @types/luxon to v3.7.5')).toBe(
        'update dependency @\u200Btypes/luxon to v3.7.5',
      );
    });

    it('leaves an email-like name@host untouched', () => {
      expect(escapeMentions('contact jane@example.com')).toBe(
        'contact jane@example.com',
      );
    });

    it('leaves code spans and URLs untouched', () => {
      expect(escapeMentions('see `@foo` at https://example.com/@bar')).toBe(
        'see `@foo` at https://example.com/@bar',
      );
    });
  });

  describe('stripPrReference', () => {
    it('strips a trailing PR reference', () => {
      expect(stripPrReference('support ~latest component refs (#45234)')).toBe(
        'support ~latest component refs',
      );
    });

    it('strips a channel marker and PR reference together', () => {
      expect(
        stripPrReference(
          'update dependency @biomejs/biome to v2.5.11 (main) (#45676)',
        ),
      ).toBe('update dependency @biomejs/biome to v2.5.11');
    });

    it('leaves a subject with no PR reference untouched', () => {
      expect(stripPrReference('add warning to `checkedBranches`')).toBe(
        'add warning to `checkedBranches`',
      );
    });
  });

  describe('attributeReleases', () => {
    it('attributes each commit to the nearest release at or after it', () => {
      const releaseTagBySha = new Map([
        ['c3', '44.61.3'],
        ['c5', '44.61.4'],
      ]);

      expect(
        attributeReleases(['c1', 'c2', 'c3', 'c4', 'c5'], releaseTagBySha),
      ).toEqual(
        new Map([
          ['c1', '44.61.3'],
          ['c2', '44.61.3'],
          ['c3', '44.61.3'],
          ['c4', '44.61.4'],
          ['c5', '44.61.4'],
        ]),
      );
    });

    it('leaves a trailing commit unattributed if no release follows it', () => {
      const releaseTagBySha = new Map([['c1', '44.61.3']]);

      const result = attributeReleases(['c1', 'c2'], releaseTagBySha);
      expect(result.get('c1')).toBe('44.61.3');
      expect(result.has('c2')).toBe(false);
    });
  });

  describe('renderModuleChangelog release links', () => {
    it('appends a release link when the commit has one', () => {
      const groups = groupByModule(
        [
          {
            type: 'fix',
            scope: 'workers/repository',
            subject: 'a',
            release: '44.61.3',
          },
        ],
        types,
        new Map(),
      );

      expect(renderModuleChangelog(groups, repo)).toBe(
        [
          '### workers/repository',
          '',
          '- fix: a ([44.61.3](https://github.com/renovatebot/renovate/releases/tag/44.61.3))',
        ].join('\n'),
      );
    });

    it('omits the release link when the commit has none', () => {
      const groups = groupByModule(
        [{ type: 'fix', scope: 'workers/repository', subject: 'a' }],
        types,
        new Map(),
      );

      expect(renderModuleChangelog(groups, repo)).toBe(
        ['### workers/repository', '', '- fix: a'].join('\n'),
      );
    });
  });
});
