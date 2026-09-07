import { RuleTester } from 'oxlint/plugins-dev';
import rule from './no-host-rules-mock.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('no-host-rules-mock', rule, {
  valid: [
    // identifier callee
    `mock('./host-rules');`,
    // computed member access
    `vi['mock']('./host-rules');`,
    // other object
    `jest.mock('./host-rules');`,
    // other method
    `vi.unmock('./host-rules');`,
    // similarly named modules are fine
    `vi.mock('./host-rules-from-env');`,
    `vi.mock('./my-host-rules-helper');`,
    // unrelated modules
    `vi.mock('./foo.ts');`,
    // no arguments
    `vi.mock();`,
    // non-literal specifier
    `vi.mock(specifier);`,
    // non-string literal
    `vi.mock(42);`,
    // computed member callee property
    `vi[method]('./host-rules');`,
  ],
  invalid: [
    {
      code: `vi.mock('./host-rules');`,
      errors: [{ messageId: 'noHostRulesMock' }],
    },
    {
      code: `vi.doMock('./host-rules');`,
      errors: [{ messageId: 'noHostRulesMock' }],
    },
    {
      code: `vi.mock('host-rules');`,
      errors: [{ messageId: 'noHostRulesMock' }],
    },
    {
      code: `vi.mock('../../util/host-rules.ts');`,
      errors: [{ messageId: 'noHostRulesMock' }],
    },
    {
      code: `vi.mock('./host-rules.js');`,
      errors: [{ messageId: 'noHostRulesMock' }],
    },
    {
      code: `vi.mock('./host-rules.mjs');`,
      errors: [{ messageId: 'noHostRulesMock' }],
    },
  ],
});
