import { evaluate, match, parse, tokenize, validate } from './main';

describe('util/package-rules/match/main', () => {
  describe('match()', () => {
    const data = {
      packageName: 'foo',
      isBreaking: true,
      depType: 'dependencies',
      updateType: 'patch',
      currentVersion: '1.0.0',
      newVersion: '1.0.1',
      newMajor: 1,
      score: 85,
      active: false,
      tags: ['alpha', 'beta'],
      count: 0,
      price: null,
      priority: 'high',
      category: 'utilities',
      enabled: true,
      status: 'active',
      features: ['feature1', 'feature2'],
    };

    describe('advanced logic expressions', () => {
      it.each`
        input                                                                                                           | expected
        ${'(packageName = "foo" AND isBreaking = true) OR (depType = "devDependencies" AND updateType = "minor")'}      | ${true}
        ${'(packageName = "bar" OR packageName = "baz") AND (isBreaking = true OR updateType = "major")'}               | ${false}
        ${'((newMajor >= 1 AND newMajor <= 2) OR score > 90) AND active = false'}                                       | ${true}
        ${'(tags ANY ["beta", "gamma"] AND features ANY ["feature1"]) OR (priority = "low" AND enabled = false)'}       | ${true}
        ${'notExistingKey = "value" OR (packageName = "foo" AND status = "inactive")'}                                  | ${false}
        ${'(price != null AND price > 100) OR (price = null AND count = 0)'}                                            | ${true}
        ${'((enabled = true AND status = "active") OR (enabled = false AND status = "inactive")) AND active = false'}   | ${true}
        ${'(category = "utilities" OR category = "tools") AND (priority = "medium" OR priority = "high")'}              | ${true}
        ${'(features ANY ["feature3", "feature4"] AND tags NONE ["alpha"]) OR score >= 85'}                             | ${true}
        ${'((packageName = "foo" AND isBreaking = true) OR (updateType = "minor" AND newMajor > 2)) AND active = true'} | ${false}
      `('match($input, data) = $expected', ({ input, expected }) => {
        expect(match(input, data)).toBe(expected);
      });
    });

    describe('simple matches', () => {
      it.each`
        input                                | expected
        ${'packageName = "foo"'}             | ${true}
        ${'packageName = "foo"'}             | ${true}
        ${'packageName ANY ["foo", "bar"]'}  | ${true}
        ${'packageName ANY ["no", "bar"]'}   | ${false}
        ${'packageName NONE ["foo", "bar"]'} | ${false}
        ${'packageName NONE ["no", "bar"]'}  | ${true}
        ${"packageName = 'foo'"}             | ${true}
        ${'packageName = "bar"'}             | ${false}
        ${'isBreaking = true'}               | ${true}
        ${'isBreaking = "true"'}             | ${false}
        ${'isBreaking = false'}              | ${false}
        ${'depType = "dependencies"'}        | ${true}
        ${'depType = "devDependencies"'}     | ${false}
        ${'updateType = "patch"'}            | ${true}
        ${'updateType = "minor"'}            | ${false}
        ${'currentVersion = "1.0.0"'}        | ${true}
        ${'currentVersion = "1.0.1"'}        | ${false}
        ${'newMajor = 1'}                    | ${true}
        ${'newMajor = 2'}                    | ${false}
        ${'newMajor < 2'}                    | ${true}
        ${'newMajor > 1'}                    | ${false}
        ${'newMajor >= 1'}                   | ${true}
        ${'score > 80'}                      | ${true}
        ${'score >= 85'}                     | ${true}
        ${'score < 90'}                      | ${true}
        ${'active = false'}                  | ${true}
        ${'active = true'}                   | ${false}
        ${'count = 0'}                       | ${true}
        ${'count > 0'}                       | ${false}
        ${'count > -1'}                      | ${true}
        ${'price = null'}                    | ${true}
        ${'unknownKey = "value"'}            | ${false}
        ${'newMajor ANY [1,2,3]'}            | ${true}
        ${'newMajor NONE [2,3,4]'}           | ${true}
        ${'newMajor NONE [1,2,3]'}           | ${false}
        ${'tags ANY ["beta", "gamma"]'}      | ${true}
        ${'tags NONE ["delta"]'}             | ${true}
        ${'active NONE [true]'}              | ${true}
        ${'active NONE [false]'}             | ${false}
      `('match($input, data) = $expected', ({ input, expected }) => {
        expect(match(input, data)).toBe(expected);
      });
    });

    describe('edge cases', () => {
      it.each`
        input                              | expected
        ${'newMajor = "1"'}                | ${false}
        ${'isBreaking = "true"'}           | ${false}
        ${'count < 1'}                     | ${true}
        ${'count <= 0'}                    | ${true}
        ${'count > -1'}                    | ${true}
        ${'price = null'}                  | ${true}
        ${'true = true'}                   | ${false}
        ${'null = null'}                   | ${false}
        ${'price != null'}                 | ${false}
        ${'newMajor > 0 AND newMajor < 2'} | ${true}
        ${'active != true'}                | ${true}
        ${'packageName ANY []'}            | ${false}
        ${'packageName ANY false'}         | ${false}
        ${'packageName = "a\\tb"'}         | ${false}
        ${'labels.foo = "bar"'}            | ${false}
        ${'packageName NONE []'}           | ${false}
        ${'packageName >= 2'}              | ${false}
        ${'score ANY [85,90,95]'}          | ${true}
        ${'score NONE [70,75,80]'}         | ${true}
        ${'score ANY [70,75,80]'}          | ${false}
        ${'active ANY [true, false]'}      | ${true}
        ${'active NONE [true]'}            | ${true}
        ${'active NONE [false]'}           | ${false}
      `('match($input, data) = $expected', ({ input, expected }) => {
        expect(match(input, data)).toBe(expected);
      });

      it.each([
        { input: 'count = "0"', data: { count: 0 }, expected: false },
        { input: 'active = "false"', data: { active: false }, expected: false },
        { input: 'score = 85', data: { score: '85' }, expected: false },
        { input: 'price = 100.0', data: { price: 100 }, expected: true },
        { input: 'price = 100.0', data: { price: '100.0' }, expected: false },
      ])(
        'should evaluate "$input" correctly with data $data',
        ({ input, data, expected }) => {
          expect(match(input, data)).toBe(expected);
        },
      );
    });

    it.each([
      { input: 'count = "0"', data: { count: 0 }, expected: false },
      { input: 'active = "false"', data: { active: false }, expected: false },
      { input: 'score = 85', data: { score: '85' }, expected: false },
      { input: 'price = 100.0', data: { price: 100 }, expected: true },
      { input: 'price = 100.0', data: { price: '100.0' }, expected: false },
    ])('match($input, data) = $expected', ({ input, data, expected }) => {
      expect(match(input, data)).toBe(expected);
    });

    it('should evaluate deeply nested expressions correctly', () => {
      const input =
        '((a = 1 OR (b = 2 AND c = 3)) AND (d = 4 OR (e = 5 AND f = 6)))';
      const data = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 };
      expect(match(input, data)).toBe(true);
    });

    it('should handle multiple levels of nesting with mixed operators', () => {
      const input = 'a = 1 OR (b = 2 AND (c = 3 OR (d = 4 AND e = 5)))';
      const data = { a: 0, b: 2, c: 0, d: 4, e: 5 };
      expect(match(input, data)).toBe(true);
    });

    it('should evaluate complex expressions with various operators correctly', () => {
      const input =
        'age >= 30 AND (status = "active" OR (score < 50 AND level != null))';
      const data = { age: 35, status: 'active', score: 45, level: 2 };
      expect(match(input, data)).toBe(true);
    });

    it.each([
      {
        input: 'name = "John\nDoe"',
        data: { name: 'John\nDoe' },
        expected: true,
      },
      {
        input: "name = 'Jane\tDoe'",
        data: { name: 'Jane\tDoe' },
        expected: true,
      },
      { input: 'name = "John\\\\"', data: { name: 'John\\' }, expected: true },
      {
        input: "name = 'John\\aDoe'",
        data: { name: 'JohnaDoe' },
        expected: true,
      },
    ])('match($input, data) = $expected', ({ input, data, expected }) => {
      expect(match(input, data)).toBe(expected);
    });
  });

  describe('validate()', () => {
    it('should return valid: true for valid expressions', () => {
      const result = validate('packageName = "foo"');
      expect(result.valid).toBe(true);
    });

    it.each`
      input
      ${'depType = dependencies'}
      ${'isBreaking = maybe'}
      ${'price = null, count = 0'}
      ${'packageName = "foo" AND (isBreaking = true)))'}
      ${'packageName = foo'}
      ${'packageName = "foo" AND isBreaking = tru'}
      ${'tags ANY [beta, "gamma"]'}
      ${'AND packageName = "foo"'}
      ${'OR isBreaking = true'}
      ${'packageName = "foo" AND OR isBreaking = true'}
      ${'(packageName = "foo" AND isBreaking = true'}
      ${'packageName = "foo" AND (isBreaking = true)))'}
      ${'packageName = "foo" AND (isBreaking = true) AND'}
      ${'packageName = "foo" AND (isBreaking = true) AND (depType = )'}
      ${'packageName = "foo" AND isBreaking = true AND depType = "dependencies" OR'}
      ${'packageName = "foo" AND (isBreaking = true) OR (depType = "dependencies" AND updateType = "patch"'}
      ${'packageName = "foo" AND (isBreaking = true)) OR depType = "dependencies" AND updateType = "patch"'}
      ${'packageName = "foo" AND depType = "dependencies" AND updateType patch"'}
      ${'packageName = "foo" AND depType = "dependencies" AND updateType = patch'}
      ${'packageName == "foo"'}
      ${'newMajor >= "1"'}
      ${'tags NONE [null, "beta}'}
      ${'tags ANY ["alpha", "beta",]'}
      ${'((packageName = "foo" AND isBreaking = true'}
      ${'packageName = "foo" AND (isBreaking = true AND)'}
      ${''}
      ${'==='}
      ${'packageName'}
      ${'packageName ='}
      ${'= "foo"'}
      ${'packageName = "foo" AND'}
      ${'packageName = "foo" OR'}
      ${'packageName = "foo" AND AND isBreaking = true'}
      ${'(packageName = "foo" AND isBreaking = true'}
      ${'packageName = "foo" AND (isBreaking = true))'}
      ${'packageName = "foo" AND (isBreaking = true) OR'}
      ${'packageName = "foo" AND (isBreaking = )'}
      ${'packageName = "foo" AND ( = true)'}
      ${'packageName = "foo" AND isBreaking true'}
      ${'packageName = "foo" AND isBreaking !='}
      ${'packageName = "foo" AND isBreaking = "tru'}
      ${'packageName = "foo" AND isBreaking = "true" extra'}
      ${'packageName = "foo" AND (isBreaking = true OR depType = "dependencies"'}
      ${'packageName = "foo" AND (isBreaking = true) AND'}
      ${'packageName = "foo" AND (isBreaking = true AND depType = "dependencies"'}
      ${'packageName = "foo" AND (isBreaking = true) AND (depType = "dependencies" AND updateType = "patch"'}
    `('validate($input) should be invalid', ({ input }) => {
      const result = validate(input);
      expect(result.valid).toBe(false);
    });

    it('should invalidate empty input strings', () => {
      expect(validate('')).toEqual({
        valid: false,
        message: 'Unexpected token EOF at position 0',
      });
    });
  });

  describe('tokenize()', () => {
    it('should tokenize a simple expression with AND and OR', () => {
      const input = "age >= 30 AND (status = 'active' OR status = 'pending')";
      const tokens = tokenize(input);
      const expectedTypes = [
        'IDENTIFIER',
        'GREATER_THAN_OR_EQUAL',
        'NUMBER_LITERAL',
        'AND',
        'LPAREN',
        'IDENTIFIER',
        'EQUALS',
        'STRING_LITERAL',
        'OR',
        'IDENTIFIER',
        'EQUALS',
        'STRING_LITERAL',
        'RPAREN',
        'EOF',
      ];
      const actualTypes = tokens.map((t) => t.type);
      expect(actualTypes).toEqual(expectedTypes);
    });

    it('should tokenize expressions with different literals', () => {
      const input = `name = "John Doe" AND isActive = true AND score != null`;
      const tokens = tokenize(input);
      const expectedTypes = [
        'IDENTIFIER',
        'EQUALS',
        'STRING_LITERAL',
        'AND',
        'IDENTIFIER',
        'EQUALS',
        'BOOLEAN_LITERAL',
        'AND',
        'IDENTIFIER',
        'NOT_EQUALS',
        'NULL_LITERAL',
        'EOF',
      ];
      const actualTypes = tokens.map((t) => t.type);
      expect(actualTypes).toEqual(expectedTypes);
    });

    it('should handle array operators ANY and NONE', () => {
      const input = "tags ANY ['urgent', 'high'] OR priority NONE ['low']";
      const tokens = tokenize(input);
      const expectedTypes = [
        'IDENTIFIER',
        'ANY',
        'LBRACKET',
        'STRING_LITERAL',
        'COMMA',
        'STRING_LITERAL',
        'RBRACKET',
        'OR',
        'IDENTIFIER',
        'NONE',
        'LBRACKET',
        'STRING_LITERAL',
        'RBRACKET',
        'EOF',
      ];
      const actualTypes = tokens.map((t) => t.type);
      expect(actualTypes).toEqual(expectedTypes);
    });

    it('should throw an error for unterminated string literals', () => {
      const input = "name = 'John Doe";
      expect(() => tokenize(input)).toThrow();
    });

    it('should handle negative numbers', () => {
      const input = 'balance >= -1000.50';
      const tokens = tokenize(input);
      const expectedTypes = [
        'IDENTIFIER',
        'GREATER_THAN_OR_EQUAL',
        'NUMBER_LITERAL',
        'EOF',
      ];
      const actualTypes = tokens.map((t) => t.type);
      expect(actualTypes).toEqual(expectedTypes);
      expect(tokens[2].value).toBe('-1000.50');
    });

    it.each([
      { input: 'AND', message: 'Unexpected token AND' },
      { input: 'OR', message: 'Unexpected token OR' },
      { input: 'AND OR', message: 'Unexpected token AND' },
      { input: 'OR AND', message: 'Unexpected token OR' },
    ])(
      'should invalidate expressions with only logical operators like "$input"',
      ({ input, message }) => {
        const tokens = tokenize(input);
        expect(() => parse(tokens)).toThrow(message);
      },
    );
  });

  describe('parse()', () => {
    it('should parse a simple AND expression', () => {
      const tokens = tokenize('age >= 30 AND isActive = true');
      const ast = parse(tokens);
      expect(ast.type).toBe('BinaryOp');
      expect(ast.operator).toBe('AND');
      expect(ast.left?.type).toBe('Comparison');
      expect(ast.right?.type).toBe('Comparison');
    });

    it('should parse nested expressions with parentheses', () => {
      const tokens = tokenize(
        "age >= 30 AND (status = 'active' OR status = 'pending')",
      );
      const ast = parse(tokens);
      expect(ast.type).toBe('BinaryOp');
      expect(ast.operator).toBe('AND');
      expect(ast.left?.type).toBe('Comparison');
      expect(ast.right?.type).toBe('BinaryOp');
      expect(ast.right?.operator).toBe('OR');
    });

    it('should parse expressions with array operators', () => {
      const tokens = tokenize("tags ANY ['urgent', 'high']");
      const ast = parse(tokens);
      expect(ast.type).toBe('Comparison');
      expect(ast.operator).toBe('ANY');
      expect(ast.key).toBe('tags');
      expect(ast.value).toEqual(['urgent', 'high']);
    });

    it('should throw an error for invalid syntax', () => {
      const tokens = tokenize('age >= 30 AND');
      expect(() => parse(tokens)).toThrow('Unexpected token EOF at position');
    });

    it('should throw an error for invalid operators', () => {
      const input = 'age >>> 30';
      const tokens = tokenize(input);
      expect(() => parse(tokens)).toThrow(
        'Expected a value, but got GREATER_THAN',
      );
    });

    it('should throw an error for mismatched parentheses', () => {
      const input = '(age >= 30';
      const tokens = tokenize(input);
      expect(() => parse(tokens)).toThrow('Expected token type');
    });
  });

  describe('evaluate()', () => {
    const data = {
      age: 35,
      status: 'active',
      isActive: true,
      tags: ['urgent', 'new'],
      balance: -500,
      priority: 'medium',
      score: null,
      a: 1,
      b: 2,
      c: 3,
      d: 4,
      e: 5,
      f: 6,
    };

    it('should evaluate simple comparison expressions', () => {
      const ast = parse(tokenize('age >= 30'));
      expect(evaluate(ast, data)).toBe(true);

      const ast2 = parse(tokenize('age < 30'));
      expect(evaluate(ast2, data)).toBe(false);

      const ast3 = parse(tokenize('age <= 30'));
      expect(evaluate(ast3, data)).toBe(false);
    });

    it('should throw error when using relational operators on non numbers', () => {
      expect(() =>
        evaluate(parse(tokenize('age > "abc"')), { age: 12 }),
      ).toThrow();
    });

    it('should evaluate logical AND expressions', () => {
      const ast = parse(tokenize('age >= 30 AND isActive = true'));
      expect(evaluate(ast, data)).toBe(true);

      const ast2 = parse(tokenize('age >= 30 AND isActive = false'));
      expect(evaluate(ast2, data)).toBe(false);
    });

    it('should evaluate logical OR expressions', () => {
      const ast = parse(tokenize("status = 'active' OR status = 'pending'"));
      expect(evaluate(ast, data)).toBe(true);

      const ast2 = parse(tokenize("status = 'inactive' OR status = 'pending'"));
      expect(evaluate(ast2, data)).toBe(false);
    });

    it('should evaluate array operators ANY and NONE', () => {
      const astAny = parse(tokenize("tags ANY ['urgent', 'high']"));
      expect(evaluate(astAny, data)).toBe(true);

      const astNone = parse(tokenize("priority NONE ['low']"));
      expect(evaluate(astNone, data)).toBe(true);

      const astAnyNoneEmpty = parse(tokenize('tags ANY []'));
      expect(evaluate(astAnyNoneEmpty, data)).toBe(false);

      const astAnyFalse = parse(tokenize("tags ANY ['low', 'medium']"));
      expect(evaluate(astAnyFalse, data)).toBe(false);

      const astNoneFalse = parse(tokenize("priority NONE ['medium']"));
      expect(evaluate(astNoneFalse, data)).toBe(false);
    });

    it('should evaluate complex nested expressions', () => {
      const ast = parse(
        tokenize(
          "age >= 30 AND (status = 'active' OR (score < 50 AND level != null))",
        ),
      );
      expect(
        evaluate(ast, { age: 35, status: 'active', score: 45, level: 2 }),
      ).toBe(true);
      expect(
        evaluate(ast, { age: 25, status: 'active', score: 45, level: 2 }),
      ).toBe(false);
      expect(
        evaluate(ast, { age: 35, status: 'inactive', score: 45, level: null }),
      ).toBe(false);
    });

    it('should return false when dataValue is undefined', () => {
      const ast = parse(tokenize('age = 30'));
      expect(evaluate(ast, {})).toBe(false);
    });

    it('should return true when both dataValue and compNode.value are null for EQUALS', () => {
      const ast = parse(tokenize('field = null'));
      expect(evaluate(ast, { field: null })).toBe(true);
    });

    it('should return false when one is null and the other is not for EQUALS', () => {
      const ast = parse(tokenize('field = null'));
      expect(evaluate(ast, { field: 'not null' })).toBe(false);
    });

    it('should allow null comparisons in NOT_EQUALS', () => {
      const ast = parse(tokenize('field != null'));
      expect(evaluate(ast, { field: 'not null' })).toBe(true);
      expect(evaluate(ast, { field: null })).toBe(false);
    });

    it('should return false when using relational operators on undefined fields', () => {
      const ast = parse(tokenize('age > 20'));
      expect(evaluate(ast, {})).toBe(false);
    });
  });

  it('should return true when both dataValue and compNode.value are null for EQUALS', () => {
    const ast = parse(tokenize('field = null'));
    expect(evaluate(ast, { field: null })).toBe(true);
  });

  it('should return false when one is null and the other is not for EQUALS', () => {
    const ast = parse(tokenize('field = null'));
    expect(evaluate(ast, { field: 'not null' })).toBe(false);
  });

  it('should allow null comparisons in NOT_EQUALS', () => {
    const ast = parse(tokenize('field != null'));
    expect(evaluate(ast, { field: 'not null' })).toBe(true);
    expect(evaluate(ast, { field: null })).toBe(false);
  });

  it('should short-circuit AND evaluation when the first condition is false', () => {
    const ast = parse(tokenize('isActive = true AND shouldNotEvaluate = true'));
    const data = { isActive: false, shouldNotEvaluate: true };

    // Spy on the evaluate function to ensure 'shouldNotEvaluate' is not evaluated
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const evaluateSpy = jest.spyOn(require('./main'), 'evaluate');

    expect(evaluate(ast, data)).toBe(false);
    expect(evaluateSpy).toHaveBeenCalledTimes(1); // Only 'isActive = false' is evaluated
    evaluateSpy.mockRestore();
  });

  it('should short-circuit OR evaluation when the first condition is true', () => {
    const ast = parse(tokenize('isActive = true OR shouldNotEvaluate = false'));
    const data = { isActive: true, shouldNotEvaluate: false };

    // Spy on the evaluate function to ensure 'shouldNotEvaluate' is not evaluated
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const evaluateSpy = jest.spyOn(require('./main'), 'evaluate');

    expect(evaluate(ast, data)).toBe(true);
    expect(evaluateSpy).toHaveBeenCalledTimes(1); // Only 'isActive = true' is evaluated
    evaluateSpy.mockRestore();
  });
});
