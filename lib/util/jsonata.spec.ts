import * as memCache from './cache/memory';
import { getExpression } from './jsonata';

describe('util/jsonata', () => {
  describe('getExpression', () => {
    it('should return an expression', () => {
      expect(getExpression('foo')).not.toBeInstanceOf(Error);
    });

    it('should return an error', () => {
      expect(getExpression('foo[')).toBeInstanceOf(Error);
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
