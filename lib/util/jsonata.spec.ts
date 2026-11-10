import * as memCache from './cache/memory/index.ts';
import { getExpression } from './jsonata.ts';

describe('util/jsonata', () => {
  describe('getExpression', () => {
    it('should return an expression', () => {
      expect(getExpression('foo')).not.toBeInstanceOf(Error);
    });

    it('should return an error', () => {
      expect(getExpression('foo[')).toBeInstanceOf(Error);
    });

    describe('$detectPlatform', () => {
      it('should return platform for known URL', async () => {
        const expression = getExpression(
          '$detectPlatform("https://github.com/foo/bar")',
        );
        expect(expression).not.toBeInstanceOf(Error);
        // make typescript happy
        if (expression instanceof Error) {
          throw expression;
        }
        const result = await expression.evaluate({});
        expect(result).toBe('github');
      });

      it('should return null for unknown URL', async () => {
        const expression = getExpression(
          '$detectPlatform("https://unknown.example.com")',
        );
        expect(expression).not.toBeInstanceOf(Error);
        // make typescript happy
        if (expression instanceof Error) {
          throw expression;
        }
        const result = await expression.evaluate({});
        expect(result).toBeNull();
      });
    });

    describe('$matchRegexOrGlob', () => {
      async function evaluate(input: string, data: unknown): Promise<unknown> {
        const expression = getExpression(input);
        // make typescript happy
        if (expression instanceof Error) {
          throw expression;
        }
        return await expression.evaluate(data);
      }

      const scopeExpression =
        '$matchRegexOrGlob(packageName, ["@myorg{/,}**", "com.myorg{/,}**"])';

      it.each`
        packageName          | expected
        ${'@myorg/foo'}      | ${true}
        ${'@myorg'}          | ${true}
        ${'@myorg-labs/foo'} | ${false}
        ${'com.myorg:foo'}   | ${true}
        ${'@MYORG/Foo'}      | ${true}
      `(
        'matches glob patterns against "$packageName"',
        async ({ packageName, expected }) => {
          await expect(
            evaluate(scopeExpression, { packageName }),
          ).resolves.toBe(expected);
        },
      );

      it('supports regex patterns', async () => {
        const expression = '$matchRegexOrGlob(packageName, ["/^@myorg\\//"])';
        await expect(
          evaluate(expression, { packageName: '@myorg/foo' }),
        ).resolves.toBe(true);
        await expect(
          evaluate(expression, { packageName: '@myorg-labs/foo' }),
        ).resolves.toBe(false);
      });

      it('supports negative patterns', async () => {
        const expression = '$matchRegexOrGlob(packageName, ["!@myorg{/,}**"])';
        await expect(
          evaluate(expression, { packageName: '@myorg/foo' }),
        ).resolves.toBe(false);
        await expect(
          evaluate(expression, { packageName: 'lodash' }),
        ).resolves.toBe(true);
      });

      it('returns true if any array element matches', async () => {
        const result = await evaluate(
          '$matchRegexOrGlob(registryUrls, ["https://example.com/**"])',
          {
            registryUrls: [
              'https://registry.npmjs.org',
              'https://example.com/npm',
            ],
          },
        );
        expect(result).toBe(true);
      });

      it('returns false if no array element matches', async () => {
        const result = await evaluate(
          '$matchRegexOrGlob(registryUrls, ["https://example.com/**"])',
          { registryUrls: ['https://registry.npmjs.org', 42] },
        );
        expect(result).toBe(false);
      });

      it('returns false for missing input', async () => {
        const result = await evaluate(
          '$matchRegexOrGlob(packageName, ["**"])',
          {},
        );
        expect(result).toBe(false);
      });

      it('returns false for non-string input', async () => {
        const result = await evaluate(
          '$matchRegexOrGlob(packageName, ["**"])',
          { packageName: 42 },
        );
        expect(result).toBe(false);
      });

      it('accepts a single string pattern', async () => {
        const result = await evaluate(
          '$matchRegexOrGlob(packageName, "@myorg{/,}**")',
          { packageName: '@myorg/foo' },
        );
        expect(result).toBe(true);
      });

      it('returns false for empty patterns', async () => {
        const result = await evaluate('$matchRegexOrGlob(packageName, [])', {
          packageName: '@myorg/foo',
        });
        expect(result).toBe(false);
      });

      it('returns false for missing patterns', async () => {
        const result = await evaluate('$matchRegexOrGlob(packageName)', {
          packageName: '@myorg/foo',
        });
        expect(result).toBe(false);
      });

      it('returns false for non-string patterns', async () => {
        const result = await evaluate(
          '$matchRegexOrGlob(packageName, ["@myorg{/,}**", 42])',
          { packageName: '@myorg/foo' },
        );
        expect(result).toBe(false);
      });
    });

    describe('concurrent evaluation', () => {
      beforeEach(() => {
        memCache.init();
      });

      it('should maintain data isolation when evaluating same expression concurrently', async () => {
        // Expression that uses $$ to reference the root input
        // and returns a property that identifies which input it received
        const expression = getExpression('$$.id');

        if (expression instanceof Error) {
          throw expression;
        }

        // Create multiple inputs with unique identifiers
        const inputs = Array.from({ length: 100 }, (_, i) => ({
          id: `input-${i}`,
        }));

        // Evaluate all concurrently
        const results = await Promise.all(
          inputs.map((input) => expression.evaluate(input)),
        );

        // Each result should match its corresponding input
        // If there's a race condition, some results will have wrong ids
        results.forEach((result, index) => {
          expect(result).toBe(`input-${index}`);
        });
      });

      it('should maintain data isolation with complex $$ references', async () => {
        // More complex expression that processes root data multiple times
        const expression = getExpression(
          '{ "original": $$.value, "doubled": $$.value * 2, "id": $$.id }',
        );

        if (expression instanceof Error) {
          throw expression;
        }

        const inputs = Array.from({ length: 50 }, (_, i) => ({
          id: i,
          value: i * 10,
        }));

        const results = await Promise.all(
          inputs.map((input) => expression.evaluate(input)),
        );

        results.forEach((result, index) => {
          expect(result).toEqual({
            original: index * 10,
            doubled: index * 20,
            id: index,
          });
        });
      });
    });
  });
});
