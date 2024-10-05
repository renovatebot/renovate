// match.spec.ts

import { match, validate } from './main';

// Helper function to escape special characters in regular expressions
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('util/package-rules/match', () => {
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
      ${'packageName ANY ["foo", "bar"]'}  | ${true}
      ${'packageName ANY ["no", "bar"]'}   | ${false}
      ${'packageName NONE ["foo", "bar"]'} | ${false}
      ${'packageName NONE ["no", "bar"]'}  | ${true}
      ${"packageName = 'foo'"}             | ${true}
      ${'packageName = "bar"'}             | ${false}
      ${'isBreaking = true'}               | ${true}
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
      ${'price != null'}                 | ${false}
      ${'newMajor > 0 AND newMajor < 2'} | ${true}
      ${'active != true'}                | ${true}
      ${'packageName ANY []'}            | ${false}
      ${'packageName NONE []'}           | ${false}
      ${'score ANY [85,90,95]'}          | ${true}
      ${'score NONE [70,75,80]'}         | ${true}
      ${'score ANY [70,75,80]'}          | ${false}
      ${'active ANY [true, false]'}      | ${true}
      ${'active NONE [true]'}            | ${true}
      ${'active NONE [false]'}           | ${false}
    `('match($input, data) = $expected', ({ input, expected }) => {
      expect(match(input, data)).toBe(expected);
    });
  });

  describe('invalid expressions', () => {
    describe('through validate()', () => {
      it.each`
        input                                                          | errorMessage
        ${'packageName = '}                                            | ${'Expected a value, but got EOF at position'}
        ${'newMajor > '}                                               | ${'Expected a value, but got EOF at position'}
        ${'isBreaking ANY true'}                                       | ${'Expected token type LBRACKET, but got BOOLEAN_LITERAL at position'}
        ${'packageName = "foo" AND'}                                   | ${'Unexpected token EOF at position'}
        ${'packageName = "foo" OR OR isBreaking = true'}               | ${'Unexpected token OR at position'}
        ${'count >'}                                                   | ${'Expected a value, but got EOF at position'}
        ${'= "foo"'}                                                   | ${'Unexpected token EQUALS at position'}
        ${'packageName = "foo" AND (isBreaking = true'}                | ${'Expected token type RPAREN, but got EOF at position'}
        ${'(tags ANY ["alpha", "beta"] AND features ANY ["feature1"]'} | ${'Expected token type RPAREN, but got EOF at position'}
      `(
        'validate($input) throws error with message: $errorMessage',
        ({ input, errorMessage }) => {
          const result = validate(input);
          expect(result.valid).toBe(false);
          expect(result.message).toMatch(
            new RegExp(escapeRegExp(errorMessage)),
          );
        },
      );
    });

    describe('through match()', () => {
      it.each`
        input               | expected
        ${'unknownKey > 5'} | ${false}
      `('match($input, data) = $expected', ({ input, expected }) => {
        expect(match(input, data)).toBe(expected);
      });
    });
  });
});
