import type { ParsedCommit } from './module-changelog.ts';
import {
  groupByModule,
  parseCommitHeader,
  renderModuleChangelog,
} from './module-changelog.ts';

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

  describe('groupByModule', () => {
    const types = [
      { type: 'feat', section: 'Features' },
      { type: 'fix', section: 'Bug Fixes' },
      { type: 'refactor', section: 'Code Refactoring' },
    ];

    it('groups commits by scope and sorts groups alphabetically', () => {
      const commits: ParsedCommit[] = [
        { type: 'fix', scope: 'workers/repository', subject: 'a' },
        { type: 'fix', scope: 'manager/gitlab', subject: 'b' },
      ];

      expect(groupByModule(commits, types).map((g) => g.scope)).toEqual([
        'manager/gitlab',
        'workers/repository',
      ]);
    });

    it('sorts the scope-less group last', () => {
      const commits: ParsedCommit[] = [
        { type: 'docs', scope: undefined, subject: 'a' },
        { type: 'fix', scope: 'manager/gitlab', subject: 'b' },
      ];

      expect(groupByModule(commits, types).map((g) => g.scope)).toEqual([
        'manager/gitlab',
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

      expect(groupByModule(commits, types)[0].commits).toEqual([
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
        { type: 'chore', scope: 'deps', subject: 'chore it' },
        { type: 'fix', scope: 'deps', subject: 'fix it' },
      ];

      expect(
        groupByModule(commits, types)[0].commits.map((c) => c.type),
      ).toEqual(['fix', 'chore']);
    });
  });

  describe('renderModuleChangelog', () => {
    it('renders a nested Markdown list', () => {
      const groups = groupByModule(
        [
          {
            type: 'fix',
            scope: 'workers/repository',
            subject: 'ensure checks',
          },
          {
            type: 'refactor',
            scope: 'workers/repository',
            subject: 'add a check',
          },
          { type: 'docs', scope: undefined, subject: 'add warning' },
        ],
        [
          { type: 'fix', section: 'Bug Fixes' },
          { type: 'refactor', section: 'Code Refactoring' },
          { type: 'docs', section: 'Documentation' },
        ],
      );

      expect(renderModuleChangelog(groups)).toBe(
        [
          '- workers/repository',
          '  - fix: ensure checks',
          '  - refactor: add a check',
          '- Other',
          '  - docs: add warning',
        ].join('\n'),
      );
    });
  });
});
