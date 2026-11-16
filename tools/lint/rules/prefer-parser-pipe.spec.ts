import { RuleTester } from 'oxlint/plugins-dev';
import rule from './prefer-parser-pipe.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('prefer-parser-pipe', rule, {
  valid: [
    // already using the pipe helper
    `Json.pipe(Schema).parse(input);`,
    `Ini.pipe(Schema).parse(input);`,
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
    `ini['parse'](input);`,
    `foo.ini.parse(input);`,
    `parse(input);`,
    `ini.stringify(input);`,
    `Schema.parse(toString.parse(input));`,
  ],
  invalid: [
    {
      code: `Schema.parse(JSON.parse(input));`,
      errors: [{ messageId: 'preferParserPipe' }],
    },
    {
      code: `Schema.safeParse(JSON.parse(input));`,
      errors: [{ messageId: 'preferParserPipe' }],
    },
    // extra arguments after the parsed value still match
    {
      code: `Schema.parse(JSON.parse(input), opts);`,
      errors: [{ messageId: 'preferParserPipe' }],
    },
    // every direct ini.parse call is reported once
    {
      code: `ini.parse(input);`,
      errors: [{ messageId: 'preferIni' }],
    },
    {
      code: `const value = ini.parse(input)['key'];`,
      errors: [{ messageId: 'preferIni' }],
    },
    {
      code: `Schema.parse(ini.parse(input));`,
      errors: [{ messageId: 'preferIni' }],
    },
    {
      code: `Schema.safeParse(ini.parse(input));`,
      errors: [{ messageId: 'preferIni' }],
    },
  ],
});
