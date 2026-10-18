import { RuleTester } from 'oxlint/plugins-dev';
import rule from './require-cacheable.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('require-cacheable', rule, {
  valid: [
    // the decision is made
    `withCache({ namespace: 'datasource-npm', key, cacheable: false }, fn);`,
    `withCache({ namespace: 'datasource-npm', key, cacheable: isPublic(url) }, fn);`,
    // shorthand and string literal keys are still the property
    `withCache({ namespace, key, cacheable }, fn);`,
    `withCache({ namespace, key, 'cacheable': true }, fn);`,
    // options we cannot see into
    `withCache(options, fn);`,
    `withCache({ ...options, key }, fn);`,
    `withCache({ namespace, key, [propertyName]: true }, fn);`,
    // some other function which happens to take options
    `withRetry({ namespace, key }, fn);`,
    `cache.withCache({ namespace, key }, fn);`,
    // no arguments at all
    `withCache();`,
  ],
  invalid: [
    {
      code: `withCache({ namespace: 'datasource-npm', key }, fn);`,
      errors: [{ messageId: 'requireCacheable' }],
    },
    {
      code: `withCache({ namespace, key, ttlMinutes: 60, fallback: true }, fn);`,
      errors: [{ messageId: 'requireCacheable' }],
    },
    {
      code: `withCache({}, fn);`,
      errors: [{ messageId: 'requireCacheable' }],
    },
    {
      // a computed key we can read is not `cacheable`
      code: `withCache({ namespace, key, ['ttlMinutes']: 60 }, fn);`,
      errors: [{ messageId: 'requireCacheable' }],
    },
  ],
});
