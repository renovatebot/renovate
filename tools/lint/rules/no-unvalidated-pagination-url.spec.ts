import { RuleTester } from 'oxlint/plugins-dev';
import rule from './no-unvalidated-pagination-url.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('no-unvalidated-pagination-url', rule, {
  valid: [
    // resolved through the same-origin helper
    `const u = new URL(resolveSameOriginUrl(links.next.url));`,
    `const u = parseUrl(resolveSameOriginUrl(links.next.url));`,
    // not a `next` link
    `const u = new URL(links.prev.url);`,
    `const u = new URL(res.url);`,
    // property is neither `url` nor `href`
    `const u = new URL(links.next.path);`,
    // `next` is not itself a member access
    `const u = new URL(next.url);`,
    // computed access is ignored
    `const u = new URL(links.next['url']);`,
    `const u = new URL(links['next'].url);`,
    // other constructors / callees
    `const u = new Other(links.next.url);`,
    `const u = otherFn(links.next.url);`,
    `const u = url.parseUrl(links.next.url);`,
    // not a member expression at all
    `const u = new URL(nextUrl);`,
    `const u = new URL();`,
  ],
  invalid: [
    {
      code: `const u = new URL(links.next.url);`,
      errors: [{ messageId: 'noUnvalidatedPaginationUrl' }],
    },
    {
      code: `const u = new URL(links.next.href);`,
      errors: [{ messageId: 'noUnvalidatedPaginationUrl' }],
    },
    {
      code: `const u = parseUrl(links.next.url);`,
      errors: [{ messageId: 'noUnvalidatedPaginationUrl' }],
    },
    {
      code: `const u = parseUrl(links.next.href);`,
      errors: [{ messageId: 'noUnvalidatedPaginationUrl' }],
    },
    // optional chaining
    {
      code: `const u = new URL(links?.next?.url);`,
      errors: [{ messageId: 'noUnvalidatedPaginationUrl' }],
    },
    // non-null assertions
    {
      code: `const u = new URL(links!.next!.url);`,
      errors: [{ messageId: 'noUnvalidatedPaginationUrl' }],
    },
    // any argument position counts
    {
      code: `const u = new URL(links.next.url, base);`,
      errors: [{ messageId: 'noUnvalidatedPaginationUrl' }],
    },
    {
      code: `const u = new URL(base, links.next.url);`,
      errors: [{ messageId: 'noUnvalidatedPaginationUrl' }],
    },
  ],
});
