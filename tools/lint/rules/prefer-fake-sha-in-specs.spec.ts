import { RuleTester } from 'oxlint/plugins-dev';
import rule from './prefer-fake-sha-in-specs.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('prefer-fake-sha-in-specs', rule, {
  valid: [
    `const sha = fakeSha();`,
    `const sha = fakeSha('abc');`,
    // other type references
    `const sha = 'abc' as string;`,
    `const sha = 'abc' as ShortCommitSha;`,
    // not a type reference
    `const sha = 'abc' as const;`,
    `const sha = { a: 1 } as { a: number };`,
    // qualified type names are not plain identifiers
    `const sha = 'abc' as git.LongCommitSha;`,
    // type annotations are not `as` expressions
    `const sha: LongCommitSha = fakeSha();`,
    `let sha!: LongCommitSha;`,
  ],
  invalid: [
    {
      code: `const sha = 'abc' as LongCommitSha;`,
      errors: [{ messageId: 'preferFakeSha' }],
    },
    {
      code: `const sha = '0'.repeat(40) as LongCommitSha;`,
      errors: [{ messageId: 'preferFakeSha' }],
    },
    {
      code: `foo({ sha: 'abc' as LongCommitSha });`,
      errors: [{ messageId: 'preferFakeSha' }],
    },
    {
      code: `const a = 'abc' as LongCommitSha;\nconst b = 'def' as LongCommitSha;`,
      errors: [{ messageId: 'preferFakeSha' }, { messageId: 'preferFakeSha' }],
    },
  ],
});
