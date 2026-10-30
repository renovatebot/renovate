import { RuleTester } from 'oxlint/plugins-dev';
import rule from './require-cache-privacy.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('require-cache-privacy', rule, {
  valid: [
    `withCache({ namespace: 'datasource-npm', key, public: true }, fn);`,
    `withCache({ namespace: 'datasource-npm', key, public: isPublic(url) }, fn);`,
    `withCache({ namespace, key, public: isPublic }, fn);`,
    `withCache({ namespace, key, 'public': false }, fn);`,
    `withCache({ namespace, key, public: true }, () => value);`,
    `withCache({ namespace, key }, async (ctx) => { ctx.public = isPublic(await fetchData()); return value; });`,
    `withCache({ namespace, key }, function (context) { context['public'] = false; return value; });`,
    `withCache({ namespace, key }, (ctx) => { if (isPrivate) { ctx.public = false; } return value; });`,
    `withCache({ namespace, key }, (ctx) => { if (isPublic) { ctx['public'] = true; } else { return value; } return value; });`,
    `withCache({ namespace, key }, (ctx) => ctx.public = false);`,
    `withCache({ namespace, key }, (ctx) => { const decide = () => { ctx.public = true; }; decide(); return value; });`,
    `withCache({ namespace, key, public: false }, (ctx) => value);`,
    `this.cached({ key, public: true }, fn);`,
    `this.cached({ key }, (ctx) => { ctx.public = false; return value; });`,
    `withCache(options, fn);`,
    `withCache({ ...options, key }, fn);`,
    `withCache({ namespace, key, [propertyName]: true }, fn);`,
    `withRetry({ namespace, key }, fn);`,
    `cache.withCache({ namespace, key }, fn);`,
    `withCache();`,
  ],
  invalid: [
    {
      code: `withCache({ namespace: 'datasource-npm', key }, fn);`,
      errors: [{ messageId: 'requirePublic' }],
    },
    {
      code: `withCache({ namespace, key, ttlMinutes: 60, fallback: true }, fn);`,
      errors: [{ messageId: 'requirePublic' }],
    },
    {
      code: `withCache({}, fn);`,
      errors: [{ messageId: 'requirePublic' }],
    },
    {
      code: `withCache({ namespace, key, ['ttlMinutes']: 60 }, fn);`,
      errors: [{ messageId: 'requirePublic' }],
    },
    {
      code: `withCache({ namespace, key }, () => value);`,
      errors: [{ messageId: 'requirePublic' }],
    },
    {
      code: `this.cached({ key }, () => value);`,
      errors: [{ messageId: 'requirePublic' }],
    },
    {
      code: `withCache({ namespace, key }, (ctx) => value);`,
      errors: [{ messageId: 'requirePublic' }],
    },
    {
      code: `withCache({ namespace, key }, function (ctx) { return load(ctx); });`,
      errors: [{ messageId: 'requirePublic' }],
    },
    {
      code: `this.cached({ key }, (ctx) => load(ctx));`,
      errors: [{ messageId: 'requirePublic' }],
    },
    {
      code: `withCache({ namespace, key }, (ctx) => { if (ctx.public === true) { return value; } return null; });`,
      errors: [{ messageId: 'requirePublic' }],
    },
    {
      code: `withCache({ namespace, key }, (ctx) => { other.public = true; return value; });`,
      errors: [{ messageId: 'requirePublic' }],
    },
    {
      code: `withCache({ namespace, key }, (ctx) => { const decide = (ctx) => { ctx.public = true; }; return value; });`,
      errors: [{ messageId: 'requirePublic' }],
    },
    {
      code: `withCache({ namespace, key }, (ctx) => { { const ctx = {}; ctx.public = true; } return value; });`,
      errors: [{ messageId: 'requirePublic' }],
    },
    {
      code: `withCache({ namespace, key }, (ctx, other) => { other.public = true; return value; });`,
      errors: [{ messageId: 'requirePublic' }],
    },
    {
      code: `withCache({ namespace, key }, ({ public: isPublic }) => value);`,
      errors: [{ messageId: 'requirePublic' }],
    },
    {
      code: `withCache({ namespace, key }, (ctx) => { ctx[field] = true; return value; });`,
      errors: [{ messageId: 'requirePublic' }],
    },
    {
      code: `withCache({ namespace, key }, (ctx) => { other[ctx] = true; return value; });`,
      errors: [{ messageId: 'requirePublic' }],
    },
    {
      code: `withCache({ namespace, key }, (ctx) => { other.value = ctx.public; return value; });`,
      errors: [{ messageId: 'requirePublic' }],
    },
  ],
});
