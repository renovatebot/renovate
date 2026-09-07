import { RuleTester } from 'oxlint/plugins-dev';
import rule from './logger-static-message.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('logger-static-message', rule, {
  valid: [
    `logger.warn('Static message');`,
    `logger.error({ url }, 'Failed to fetch');`,
    `logger.fatal({ err }, 'Fatal error');`,
    `logger.once.warn('Static message');`,
    // non-flagged levels may interpolate
    'logger.debug(`Fetching ${url}`);',
    'logger.info(`Fetching ${url}`);',
    // template literal without expressions is static
    'logger.warn(`Static message`);',
    // not a logger call
    'other.warn(`Fetching ${url}`);',
    `logger.warn();`,
    // error-ish value under the err key is fine
    `logger.error({ err }, 'Failed');`,
    // non-error-ish value under the error key is fine
    `logger.error({ error: 'string' }, 'Failed');`,
    // computed member calls are ignored
    `logger['warn']('Static message');`,
  ],
  invalid: [
    {
      code: 'logger.warn(`Failed to fetch ${url}`);',
      errors: [{ messageId: 'staticMessage' }],
    },
    {
      code: 'logger.error(`Failed to fetch ${url}`);',
      errors: [{ messageId: 'staticMessage' }],
    },
    {
      code: 'logger.fatal(`Failed to fetch ${url}`);',
      errors: [{ messageId: 'staticMessage' }],
    },
    {
      code: 'logger.once.warn(`Failed to fetch ${url}`);',
      errors: [{ messageId: 'staticMessage' }],
    },
    {
      code: `logger.warn('Failed to fetch ' + url);`,
      errors: [{ messageId: 'staticMessage' }],
    },
    {
      code: 'logger.error({ url }, `Failed to fetch ${url}`);',
      errors: [{ messageId: 'staticMessage' }],
    },
    {
      code: `logger.error({ error: err }, 'Failed');`,
      errors: [{ messageId: 'errKey' }],
    },
    {
      code: `logger.error({ error: new SomeError('x') }, 'Failed');`,
      errors: [{ messageId: 'errKey' }],
    },
    {
      code: `logger.error({ error: res.parseError }, 'Failed');`,
      errors: [{ messageId: 'errKey' }],
    },
    {
      code: `logger.error({ error: err as Error }, 'Failed');`,
      errors: [{ messageId: 'errKey' }],
    },
    {
      code: `logger.error({ 'error': err }, 'Failed');`,
      errors: [{ messageId: 'errKey' }],
    },
    {
      code: 'logger.error({ error: err }, `Failed ${url}`);',
      errors: [{ messageId: 'errKey' }, { messageId: 'staticMessage' }],
    },
  ],
});
