import { RuleTester } from 'oxlint/plugins-dev';
import rule from './logger-err-key.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('logger-err-key', rule, {
  valid: [
    `logger.error({ err }, 'Failed');`,
    `logger.debug({ err: res.error }, 'Failed');`,
    `logger.once.warn({ err }, 'Failed');`,
    // non-error-ish value under the error key is fine
    `logger.error({ error: 'string' }, 'Failed');`,
    `logger.error({ error: err.message }, 'Failed');`,
    // other keys holding an error are not flagged
    `logger.warn({ configError: error }, 'Failed');`,
    // computed keys and spreads are ignored
    `logger.error({ [key]: err }, 'Failed');`,
    `logger.error({ ...meta }, 'Failed');`,
    // no metadata object
    `logger.error('Failed');`,
    `logger.error();`,
    // not a logger call
    `other.error({ error: err }, 'Failed');`,
    `logger['error']({ error: err }, 'Failed');`,
    `logger.child.error({ error: err }, 'Failed');`,
  ],
  invalid: [
    {
      code: `logger.error({ error: err }, 'Failed');`,
      errors: [{ messageId: 'errKey' }],
      output: `logger.error({ err }, 'Failed');`,
    },
    {
      code: `logger.debug({ error }, 'Failed');`,
      errors: [{ messageId: 'errKey' }],
      output: `logger.debug({ err: error }, 'Failed');`,
    },
    {
      code: `logger.info({ error: err }, 'Failed');`,
      errors: [{ messageId: 'errKey' }],
      output: `logger.info({ err }, 'Failed');`,
    },
    {
      code: `logger.trace({ error: err }, 'Failed');`,
      errors: [{ messageId: 'errKey' }],
      output: `logger.trace({ err }, 'Failed');`,
    },
    {
      code: `logger.once.warn({ error: err }, 'Failed');`,
      errors: [{ messageId: 'errKey' }],
      output: `logger.once.warn({ err }, 'Failed');`,
    },
    {
      code: `logger.error({ exception: err }, 'Failed');`,
      errors: [{ messageId: 'errKey' }],
      output: `logger.error({ err }, 'Failed');`,
    },
    {
      code: `logger.error({ error: new SomeError('x') }, 'Failed');`,
      errors: [{ messageId: 'errKey' }],
      output: `logger.error({ err: new SomeError('x') }, 'Failed');`,
    },
    {
      code: `logger.error({ error: res.parseError }, 'Failed');`,
      errors: [{ messageId: 'errKey' }],
      output: `logger.error({ err: res.parseError }, 'Failed');`,
    },
    {
      code: `logger.error({ error: err as Error }, 'Failed');`,
      errors: [{ messageId: 'errKey' }],
      output: `logger.error({ err: err as Error }, 'Failed');`,
    },
    {
      code: `logger.error({ 'error': err }, 'Failed');`,
      errors: [{ messageId: 'errKey' }],
      output: `logger.error({ err }, 'Failed');`,
    },
    {
      code: `logger.error({ url, error: err }, 'Failed');`,
      errors: [{ messageId: 'errKey' }],
      output: `logger.error({ url, err }, 'Failed');`,
    },
  ],
});
