import { getExpression } from './jsonata';

describe('util/jsonata', () => {
  describe('getExpression', () => {
    it('should return an expression', () => {
      expect(getExpression('foo')).not.toBeInstanceOf(Error);
    });

    it('should return an error', () => {
      expect(getExpression('foo[')).toBeInstanceOf(Error);
    });
  });
});
