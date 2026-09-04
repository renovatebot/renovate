import type {
  CategoryGroup,
  FlatGroup,
  ParsedCommit,
} from './module-changelog.ts';
import {
  categoryRank,
  groupByModule,
  parseCommitHeader,
  renderModuleChangelog,
} from './module-changelog.ts';

const types = [
  { type: 'feat', section: 'Features' },
  { type: 'fix', section: 'Bug Fixes' },
  { type: 'refactor', section: 'Code Refactoring' },
];

describe('tools/release-notes/module-changelog', () => {
  describe('parseCommitHeader', () => {
    it('parses a scoped type', () => {
      expect(
        parseCommitHeader('fix(manager/gitlabci): support ~latest refs'),
      ).toEqual({
        type: 'fix',
        scope: 'manager/gitlabci',
        subject: 'support ~latest refs',
      });
    });

    it('parses an unscoped type', () => {
      expect(parseCommitHeader('docs: add warning')).toEqual({
        type: 'docs',
        scope: undefined,
        subject: 'add warning',
      });
    });

    it('parses a breaking-change marker', () => {
      expect(parseCommitHeader('feat(api)!: drop old option')).toEqual({
        type: 'feat',
        scope: 'api',
        subject: 'drop old option',
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

    it('groups a bare (non-module) scope as a flat group', () => {
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
  });

  describe('renderModuleChangelog', () => {
    it('renders category groups nested three levels deep', () => {
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

      expect(renderModuleChangelog(groups)).toBe(
        [
          '- manager',
          '  - GitLab CI/CD',
          '    - fix: support refs',
          '  - npm',
          '    - fix: massage lockstep',
        ].join('\n'),
      );
    });

    it('renders a flat group using its label', () => {
      const groups = groupByModule(
        [{ type: 'docs', scope: undefined, subject: 'add warning' }],
        [{ type: 'docs', section: 'Documentation' }],
        new Map(),
      );

      expect(renderModuleChangelog(groups)).toBe(
        ['- Other', '  - docs: add warning'].join('\n'),
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

      expect(renderModuleChangelog(groups)).toBe(
        [
          '- deps',
          '  <details>',
          '  <summary>2 updates</summary>',
          '',
          '  - chore: update foo',
          '  - build: update bar',
          '',
          '  </details>',
        ].join('\n'),
      );
    });
  });
});
