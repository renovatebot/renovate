import { RuleTester } from 'oxlint/plugins-dev';
import rule from './validate-config-warnings-and-errors.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

/**
 * Wrap a snippet in a test-like function body, matching how `validateConfig()`
 * is actually called in the codebase.
 */
function inTest(code: string): string {
  return `it('works', async () => {\n${code}\n});`;
}

ruleTester.run('validate-config-warnings-and-errors', rule, {
  valid: [
    // unrelated calls
    `foo();`,
    `obj.other(config);`,
    // computed member access is not matched
    `obj['validateConfig'](config);`,
    // destructured and both checked by value
    inTest(`
      const { warnings, errors } = await validateConfig('repo', config);
      expect(warnings).toEqual([]);
      expect(errors).toEqual([]);
    `),
    // member callee
    inTest(`
      const { warnings, errors } = configValidation.validateConfig(config);
      expect(warnings).toEqual([]);
      expect(errors).toEqual([]);
    `),
    // renamed destructured bindings
    inTest(`
      const { warnings: w, errors: e } = validateConfig(config);
      expect(w).toEqual([]);
      expect(e).toMatchObject([]);
    `),
    // identifier binding, both properties checked by value
    inTest(`
      const res = await validateConfig(config);
      expect(res.warnings).toEqual([]);
      expect(res.errors).toEqual([]);
    `),
    // a bare `.length` gate alongside a real value check is fine
    inTest(`
      const { warnings, errors } = validateConfig(config);
      if (warnings.length) {
        logger.warn(warnings);
      }
      expect(errors).toEqual([]);
    `),
    // a rest element in the pattern is ignored
    inTest(`
      const { warnings, errors, ...rest } = validateConfig(config);
      expect(warnings).toEqual([]);
      expect(errors).toEqual([]);
    `),
    // an unrelated object literal key named `warnings` is a label, not a use
    inTest(`
      const { warnings, errors } = validateConfig(config);
      expect({ warnings: somethingElse }).toEqual({});
      expect(warnings).toEqual([]);
      expect(errors).toEqual([]);
    `),
    // inside a plain function declaration
    `
      async function check() {
        const { warnings, errors } = await validateConfig(config);
        expect(warnings).toEqual([]);
        expect(errors).toEqual([]);
      }
    `,
    // inside a function expression
    `
      const check = async function () {
        const { warnings, errors } = await validateConfig(config);
        expect(warnings).toEqual([]);
        expect(errors).toEqual([]);
      };
    `,
  ],
  invalid: [
    // result not assigned at all
    {
      code: `validateConfig(config);`,
      errors: [{ messageId: 'uncheckedResult' }],
    },
    {
      code: `await validateConfig(config);`,
      errors: [{ messageId: 'uncheckedResult' }],
    },
    {
      code: `expect(validateConfig(config)).toBeDefined();`,
      errors: [{ messageId: 'uncheckedResult' }],
    },
    {
      code: `const wrapped = [validateConfig(config)];`,
      errors: [{ messageId: 'uncheckedResult' }],
    },
    // assigned to a non-Identifier, non-ObjectPattern target
    {
      code: `const [first] = validateConfig(config);`,
      errors: [{ messageId: 'uncheckedResult' }],
    },
    // destructuring only one of the two
    {
      code: inTest(`
        const { errors } = validateConfig(config);
        expect(errors).toEqual([]);
      `),
      errors: [{ messageId: 'missingWarnings' }],
    },
    {
      code: inTest(`
        const { warnings } = validateConfig(config);
        expect(warnings).toEqual([]);
      `),
      errors: [{ messageId: 'missingErrors' }],
    },
    // destructured but never used
    {
      code: inTest(`
        const { warnings, errors } = validateConfig(config);
      `),
      errors: [
        { messageId: 'lengthOnlyWarnings' },
        { messageId: 'lengthOnlyErrors' },
      ],
    },
    // checked by length only
    {
      code: inTest(`
        const { warnings, errors } = validateConfig(config);
        expect(warnings.length).toBe(0);
        expect(errors).toEqual([]);
      `),
      errors: [{ messageId: 'lengthOnlyWarnings' }],
    },
    {
      code: inTest(`
        const { warnings, errors } = validateConfig(config);
        expect(warnings).toEqual([]);
        expect(errors.length).toBe(0);
      `),
      errors: [{ messageId: 'lengthOnlyErrors' }],
    },
    // toHaveLength is banned outright, even next to a value check
    {
      code: inTest(`
        const { warnings, errors } = validateConfig(config);
        expect(warnings).toHaveLength(0);
        expect(warnings).toEqual([]);
        expect(errors).toEqual([]);
      `),
      errors: [{ messageId: 'noToHaveLength' }],
    },
    {
      code: inTest(`
        const { warnings, errors } = validateConfig(config);
        expect(warnings).toEqual([]);
        expect(errors).toHaveLength(0);
      `),
      errors: [{ messageId: 'noToHaveLength' }],
    },
    // identifier binding with only one property checked
    {
      code: inTest(`
        const res = validateConfig(config);
        expect(res.warnings).toEqual([]);
      `),
      errors: [{ messageId: 'missingErrors' }],
    },
    {
      code: inTest(`
        const res = validateConfig(config);
        expect(res.errors).toEqual([]);
      `),
      errors: [{ messageId: 'missingWarnings' }],
    },
    {
      code: inTest(`
        const res = validateConfig(config);
      `),
      errors: [
        { messageId: 'missingWarnings' },
        { messageId: 'missingErrors' },
      ],
    },
    // identifier binding checked by length only
    {
      code: inTest(`
        const res = validateConfig(config);
        expect(res.warnings.length).toBe(0);
        expect(res.errors).toEqual([]);
      `),
      errors: [{ messageId: 'lengthOnlyWarnings' }],
    },
    {
      code: inTest(`
        const res = validateConfig(config);
        expect(res.warnings).toEqual([]);
        expect(res.errors).toHaveLength(0);
      `),
      errors: [{ messageId: 'noToHaveLength' }],
    },
    // computed property access on the binding is not a recognised check
    {
      code: inTest(`
        const res = validateConfig(config);
        expect(res['warnings']).toEqual([]);
        expect(res['errors']).toEqual([]);
      `),
      errors: [
        { messageId: 'missingWarnings' },
        { messageId: 'missingErrors' },
      ],
    },
  ],
});
