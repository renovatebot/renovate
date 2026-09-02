import { RuleTester } from 'oxlint/plugins-dev';
import rule from './comment-wrapping.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

// a 9-character word, for precise column arithmetic against the 80 limit
const w9 = 'a'.repeat(9);

ruleTester.run('comment-wrapping', rule, {
  valid: [
    // short single-line comment
    `// short comment\nconst a = 1;`,
    // correct greedy wrap: the next word would not fit within 80 columns
    // (75 + 1 + 8 = 84)
    `// ${'a'.repeat(72)}\n// boundary and more text\nconst a = 1;`,
    // over-long line consisting of a single unbreakable token
    `// https://example.com/${'a'.repeat(70)}\nconst a = 1;`,
    // over-long line containing a URL
    `// see https://example.com/${'a'.repeat(70)}\nconst a = 1;`,
    // over-long code-example line: mostly code tokens, never broken
    `// testing { suites.withType(JvmTestSuite).configureEach { useJUnitJupiter("5.13.4") } }\nconst a = 1;`,
    // over-long object-literal example: keys look like prose words with
    // trailing colons, but code tokens hold the majority
    `// flakeLocked example: { rev: '56a49ffef2908dad1e9a8adef1f18802bc760962', type: 'github' }\nconst a = 1;`,
    // previous line ends a sentence, so the next line is a separate comment
    `// This is done.\n// next steps are described below\nconst a = 1;`,
    // next line starts with an uppercase word, so it is a separate comment
    `// First item description\n// Second item\nconst a = 1;`,
    // list items are never merged
    `// - alpha\n// - beta\nconst a = 1;`,
    // commented-out code: statement terminators and calls are not prose
    `// const x = getThing();\n// use(x);\nconst a = 1;`,
    // commented-out code: statement keywords never continue a sentence
    `// some things to check\n// return values are ignored\nconst a = 1;`,
    // directive comments are exempt from the length check
    `// prettier-ignore ${'a'.repeat(70)}\nconst a = 1;`,
    // trailing comments after code are ignored
    `const a = 1; // ${'a'.repeat(80)}`,
    // an empty comment line separates paragraphs
    `// ${'a'.repeat(10)}\n//\n// more text here\nconst a = 1;`,
    // differing indentation separates paragraphs
    `// outer comment text\n  // indented and more\nconst a = 1;`,
  ],
  invalid: [
    // premature wrap: everything fits on one line
    {
      code: `// aaa bbb\n// ccc ddd\nconst a = 1;`,
      errors: [{ messageId: 'prematureBreak' }],
      output: `// aaa bbb ccc ddd\nconst a = 1;`,
    },
    // premature wrap re-wraps greedily at 80 columns
    {
      code: `// \`git merge-base\` returns an empty result when no\n// common ancestor is within the shallow boundary\nconst x = 1;`,
      errors: [{ messageId: 'prematureBreak' }],
      output: `// \`git merge-base\` returns an empty result when no common ancestor is within\n// the shallow boundary\nconst x = 1;`,
    },
    // line exceeding 80 columns is broken at a word boundary
    {
      code: `// ${w9} ${w9} ${w9} ${w9} ${w9} ${w9} ${w9} ${w9}\nconst a = 1;`,
      errors: [{ messageId: 'exceedsPrintWidth' }],
      output: `// ${w9} ${w9} ${w9} ${w9} ${w9} ${w9} ${w9}\n// ${w9}\nconst a = 1;`,
    },
    // an inline code span is moved down as a whole, never split apart
    {
      code: `// Note the Link is incorrect and should be \`</a/b?n=10000&last=10000>; rel="next", \`\nconst a = 1;`,
      errors: [{ messageId: 'exceedsPrintWidth' }],
      output: `// Note the Link is incorrect and should be\n// \`</a/b?n=10000&last=10000>; rel="next", \`\nconst a = 1;`,
    },
    // a trailing prose word wraps while the inline code span stays intact
    {
      code: `// example: \`{ foo: 'bar', baz: 'qux', quux: 'corge' }\` ${'a'.repeat(30)}\nconst a = 1;`,
      errors: [{ messageId: 'exceedsPrintWidth' }],
      output: `// example: \`{ foo: 'bar', baz: 'qux', quux: 'corge' }\`\n// ${'a'.repeat(30)}\nconst a = 1;`,
    },
    // a chain of prematurely wrapped lines is joined in one fix
    {
      code: `// alpha beta\n// gamma delta\n// epsilon zeta\nconst a = 1;`,
      errors: [{ messageId: 'prematureBreak' }],
      output: `// alpha beta gamma delta epsilon zeta\nconst a = 1;`,
    },
    // indentation is preserved when re-wrapping
    {
      code: `function f(): void {\n  // aaa bbb\n  // ccc ddd\n}`,
      errors: [{ messageId: 'prematureBreak' }],
      output: `function f(): void {\n  // aaa bbb ccc ddd\n}`,
    },
    // separate paragraphs are reported and fixed independently
    {
      code: `// aaa bbb\n// ccc ddd\nconst a = 1;\n// eee fff\n// ggg hhh\nconst b = 2;`,
      errors: [
        { messageId: 'prematureBreak' },
        { messageId: 'prematureBreak' },
      ],
      output: `// aaa bbb ccc ddd\nconst a = 1;\n// eee fff ggg hhh\nconst b = 2;`,
    },
  ],
});
