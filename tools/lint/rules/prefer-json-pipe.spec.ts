import { RuleTester } from 'oxlint/plugins-dev';
import rule from './prefer-json-pipe.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('prefer-json-pipe', rule, {
  valid: [
    // already using the pipe helper
    `Json.pipe(Schema).parse(input);`,
    // plain parse of a non-JSON.parse argument
    `Schema.parse(input);`,
    `Schema.safeParse(input);`,
    // no arguments
    `Schema.parse();`,
    // other methods are not checked
    `Schema.validate(JSON.parse(input));`,
    // callee is not a member expression
    `parse(JSON.parse(input));`,
    // computed member call
    `Schema['parse'](JSON.parse(input));`,
    // inner call is not `JSON.parse`
    `Schema.parse(JSON.stringify(input));`,
    `Schema.parse(yaml.parse(input));`,
    `Schema.parse(JSON['parse'](input));`,
    `Schema.parse(foo.JSON.parse(input));`,
    `Schema.parse(parse(input));`,
  ],
  invalid: [
    {
      code: `Schema.parse(JSON.parse(input));`,
      errors: [{ messageId: 'preferJsonPipe' }],
    },
    {
      code: `Schema.safeParse(JSON.parse(input));`,
      errors: [{ messageId: 'preferJsonPipe' }],
    },
    // extra arguments after the parsed value still match
    {
      code: `Schema.parse(JSON.parse(input), opts);`,
      errors: [{ messageId: 'preferJsonPipe' }],
    },
  ],
});
