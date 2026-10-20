import path from 'node:path';
import type { ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

/**
 * A copy of `persistedResponseHeaders` in `lib/util/http/cache/persisted-headers.ts`, as this runs inside oxlint, which must not depend on `lib/`; the spec keeps the two in step.
 */
export const persistedHeaders: readonly string[] = [
  'cache-control',
  'deprecation',
  'etag',
  'last-modified',
  'link',
  'sunset',
  'x-total-count',
];

/** the cache providers whose entries are persisted, so that a response may come back from storage */
const persistedProviders = new Set([
  'PackageHttpCacheProvider',
  'RepositoryHttpCacheProvider',
  'repoCacheProvider',
  'aggressiveRepoCacheProvider',
]);

/** objects whose `headers` belong to a request rather than a response */
const requestObjects = new Set([
  'opts',
  'options',
  'httpOptions',
  'req',
  'request',
]);

/** whether `filename` is in `lib/util/http`, whose wrappers read responses that may come through `options.cacheProvider`, or below it */
function isInHttpDir(filename: string): boolean {
  const segments = filename.split(path.sep);
  const index = segments.lastIndexOf('http');
  return index >= 1 && segments[index - 1] === 'util';
}

/** a property of an object pattern, other than its rest element */
type ObjectPatternProperty = Extract<
  ESTree.ObjectPattern['properties'][number],
  { type: 'Property' }
>;

function keyName(
  key: ESTree.Expression | ESTree.PrivateIdentifier,
  computed: boolean,
): string | null {
  if (key.type === 'Literal') {
    return typeof key.value === 'string' ? key.value : null;
  }
  return !computed && key.type === 'Identifier' ? key.name : null;
}

function propertyName(node: ESTree.MemberExpression): string | null {
  return keyName(node.property, node.computed);
}

/** errors whose `response` was received from the server, never from a cache */
const errorObjects = new Set(['err', 'error']);

/** whether `node` is an error */
function isError(node: ESTree.Expression): boolean {
  return node.type === 'Identifier' && errorObjects.has(node.name);
}

/** whether `node` is an error or the `response` of an error, whose `headers` are those of the error response */
function isErrorResponse(node: ESTree.Expression): boolean {
  return (
    isError(node) ||
    (node.type === 'MemberExpression' &&
      propertyName(node) === 'response' &&
      isError(node.object))
  );
}

/** whether `node` is neither a request nor an error response, so that its `headers` may be those of a cached response */
function isResponse(node: ESTree.Expression): boolean {
  return (
    !(node.type === 'Identifier' && requestObjects.has(node.name)) &&
    !isErrorResponse(node)
  );
}

/** whether `node` is the `headers` of an object which is neither a request nor an error response */
function isResponseHeaders(node: ESTree.Expression): boolean {
  return (
    node.type === 'MemberExpression' &&
    propertyName(node) === 'headers' &&
    isResponse(node.object)
  );
}

/** returns the properties of `pattern`, without its rest element */
function patternProperties(
  pattern: ESTree.ObjectPattern,
): ObjectPatternProperty[] {
  return pattern.properties.filter(
    (property): property is ObjectPatternProperty =>
      property.type === 'Property',
  );
}

/** returns the properties of `pattern` which destructure its `headers` */
function headersProperties(
  pattern: ESTree.ObjectPattern,
): ObjectPatternProperty[] {
  return patternProperties(pattern).filter(
    (property) => keyName(property.key, property.computed) === 'headers',
  );
}

/**
 * Requires every response header read where responses may come from a persisted HTTP cache to be one the cache keeps, and flags a cache provider which keeps every header.
 *
 * Persisted cache entries hold only `persistedResponseHeaders`, so a read of any other header silently yields `undefined` on a cache hit. The rule applies to files using a persisted cache provider and to the files in `lib/util/http`, including the cache implementation, and checks member reads as well as destructuring of `headers`, also of `headers` destructured from a response, nested or bound to a variable, with or without a default value, and reads through a variable aliasing `headers`; reads through request options or errors and header assignments are ignored. A provider opting out with `persistedHeaders = null` is reported so that the opt-out carries a disable comment with its reason.
 */
export default defineRule({
  meta: {
    type: 'problem',
    messages: {
      headerNotPersisted:
        'Header `{{name}}` is read from a response that may come from a persisted HTTP cache, which only keeps {{allowed}}. Add it to `persistedResponseHeaders` in `lib/util/http/cache/persisted-headers.ts` if cached responses need it, or disable this rule with a reason where the response is always fresh.',
      keepsAllHeaders:
        'This cache provider keeps every response header. Disable this rule here with the reason why that is safe, for example because the cache never leaves the process.',
    },
  },
  createOnce(context) {
    let inScope = false;
    const assigned = new WeakSet<ESTree.Node>();
    /** the references to variables bound to the `headers` of a response */
    const headersReferences = new WeakSet<object>();

    /** reports each header destructured by `pattern` from response headers which the cache does not keep */
    function reportHeadersPattern(pattern: ESTree.ObjectPattern): void {
      for (const property of patternProperties(pattern)) {
        const name = keyName(property.key, property.computed);
        if (name === null || persistedHeaders.includes(name.toLowerCase())) {
          continue;
        }
        context.report({
          node: property,
          messageId: 'headerNotPersisted',
          data: { name, allowed: persistedHeaders.join(', ') },
        });
      }
    }

    /**
     * Checks the response headers bound to `target` by `declarator`: the headers destructured by an object pattern, and the reads through a variable, also one with a default value.
     * Destructured function parameters and destructuring assignments are not checked.
     */
    function checkHeadersBinding(
      declarator: ESTree.VariableDeclarator,
      target: ESTree.BindingPattern,
    ): void {
      if (target.type === 'AssignmentPattern') {
        checkHeadersBinding(declarator, target.left);
        return;
      }
      if (target.type === 'ObjectPattern') {
        reportHeadersPattern(target);
        return;
      }
      if (target.type !== 'Identifier') {
        return;
      }
      const variables = context.sourceCode
        .getDeclaredVariables(declarator)
        .filter((variable) => variable.name === target.name);
      for (const variable of variables) {
        for (const reference of variable.references) {
          headersReferences.add(reference.identifier);
        }
      }
    }

    return {
      before() {
        const filename = context.physicalFilename ?? context.filename;
        if (filename.endsWith('.spec.ts')) {
          return false;
        }
        inScope = isInHttpDir(filename);
      },

      ImportDeclaration(node) {
        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.type === 'Identifier' &&
            persistedProviders.has(specifier.imported.name)
          ) {
            inScope = true;
          }
        }
      },

      AssignmentExpression(node) {
        assigned.add(node.left);
      },

      PropertyDefinition(node) {
        if (
          inScope &&
          node.key.type === 'Identifier' &&
          node.key.name === 'persistedHeaders' &&
          node.value?.type === 'Literal' &&
          node.value.value === null
        ) {
          context.report({ node, messageId: 'keepsAllHeaders' });
        }
      },

      MemberExpression(node) {
        if (
          !inScope ||
          assigned.has(node) ||
          !(
            isResponseHeaders(node.object) || headersReferences.has(node.object)
          )
        ) {
          return;
        }
        const name = propertyName(node);
        if (name === null || persistedHeaders.includes(name.toLowerCase())) {
          return;
        }
        context.report({
          node,
          messageId: 'headerNotPersisted',
          data: { name, allowed: persistedHeaders.join(', ') },
        });
      },

      VariableDeclarator(node) {
        if (!inScope || !node.init) {
          return;
        }
        // `const headers = res.headers` and `const { etag } = res.headers`, also from a variable bound to response headers, such as `const { etag } = headers`
        if (isResponseHeaders(node.init) || headersReferences.has(node.init)) {
          checkHeadersBinding(node, node.id);
          return;
        }
        // `const { headers } = res`, also with a nested pattern or a default value
        if (node.id.type !== 'ObjectPattern' || !isResponse(node.init)) {
          return;
        }
        for (const property of headersProperties(node.id)) {
          checkHeadersBinding(node, property.value);
        }
      },
    };
  },
});
