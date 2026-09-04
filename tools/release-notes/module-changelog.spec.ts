import type { ParsedCommit } from './module-changelog.ts';
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
    it('groups commits by scope', () => {
      const commits: ParsedCommit[] = [
        { type: 'fix', scope: 'workers/repository', subject: 'a' },
        { type: 'fix', scope: 'tools', subject: 'b' },
      ];

      expect(
        groupByModule(commits, types, new Map()).map((g) => g.scope),
      ).toEqual(['tools', 'workers/repository']);
    });

    it('sorts module scopes ahead of non-module scopes', () => {
      const commits: ParsedCommit[] = [
        { type: 'fix', scope: 'workers/repository', subject: 'a' },
        { type: 'fix', scope: 'versioning/cargo', subject: 'b' },
      ];

      expect(
        groupByModule(commits, types, new Map()).map((g) => g.scope),
      ).toEqual(['versioning/cargo', 'workers/repository']);
    });

    it('sorts deps after non-module scopes, and Other last', () => {
      const commits: ParsedCommit[] = [
        { type: 'docs', scope: undefined, subject: 'a' },
        { type: 'chore', scope: 'deps', subject: 'b' },
        { type: 'fix', scope: 'workers/repository', subject: 'c' },
      ];

      expect(
        groupByModule(commits, types, new Map()).map((g) => g.scope),
      ).toEqual(['workers/repository', 'deps', undefined]);
    });

    it('sorts within a rank by resolved label, falling back to the scope', () => {
      const commits: ParsedCommit[] = [
        { type: 'fix', scope: 'manager/gitlabci', subject: 'a' },
        { type: 'fix', scope: 'versioning/cargo', subject: 'b' },
      ];
      const labels = new Map([
        ['manager/gitlabci', 'GitLab CI/CD'],
        ['versioning/cargo', 'Cargo'],
      ]);

      expect(groupByModule(commits, types, labels).map((g) => g.label)).toEqual(
        ['Cargo', 'GitLab CI/CD'],
      );
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

      expect(groupByModule(commits, types, new Map())[0].commits).toEqual([
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

      expect(
        groupByModule(commits, types, new Map())[0].commits.map((c) => c.type),
      ).toEqual(['fix', 'chore']);
    });
  });

  describe('renderModuleChangelog', () => {
    it('renders a nested Markdown list, using the resolved label', () => {
      const groups = groupByModule(
        [
          { type: 'fix', scope: 'versioning/cargo', subject: 'ensure checks' },
          { type: 'docs', scope: undefined, subject: 'add warning' },
        ],
        [
          { type: 'fix', section: 'Bug Fixes' },
          { type: 'docs', section: 'Documentation' },
        ],
        new Map([['versioning/cargo', 'Cargo']]),
      );

      expect(renderModuleChangelog(groups)).toBe(
        [
          '- Cargo',
          '  - fix: ensure checks',
          '- Other',
          '  - docs: add warning',
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
