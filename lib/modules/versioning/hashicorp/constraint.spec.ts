import { Constraints } from './constraint';
import { Version } from './version';

// Implements the exact same test set as the definition of
// https://github.com/hashicorp/go-version/blob/main/constraint_test.go
// except TestConstraintPrerelease and TestConstraintEqual
// as that functionality has not been implemented in constraint.ts

describe('modules/versioning/hashicorp/constraint', () => {
  // TestNewConstraint
  it.each`
    input                                          | count | throws
    ${'>=1.2'}                                     | ${1}  | ${false}
    ${'1.0'}                                       | ${1}  | ${false}
    ${'>= 1.x'}                                    | ${0}  | ${true}
    ${'> 1.2, < 1.0'}                              | ${2}  | ${false}
    ${'11387778780781445675529500000000000000000'} | ${0}  | ${true}
  `(
    'new Constraints("$input").count === $count ($throws) ',
    ({ input, count, throws }) => {
      let threw = false;
      try {
        const constraints = new Constraints(input);
        expect(constraints.length).toBe(count);
      } catch (e) {
        expect(e).toBeInstanceOf(Error); // bs check to statisfy eslint
        threw = true;
      }
      expect(threw).toBe(throws);
    },
  );

  // TestConstraintCheck
  it.each`
    range              | version          | expected
    ${'>= 1.0, < 1.2'} | ${'1.1.5'}       | ${true}
    ${'< 1.0, < 1.2'}  | ${'1.1.5'}       | ${false}
    ${'= 1.0'}         | ${'1.1.5'}       | ${false}
    ${'= 1.0'}         | ${'1.0.0'}       | ${true}
    ${'1.0'}           | ${'1.0.0'}       | ${true}
    ${'~> 1.0'}        | ${'2.0'}         | ${false}
    ${'~> 1.0'}        | ${'1.1'}         | ${true}
    ${'~> 1.0'}        | ${'1.2.3'}       | ${true}
    ${'~> 1.0.0'}      | ${'1.2.3'}       | ${false}
    ${'~> 1.0.0'}      | ${'1.0.7'}       | ${true}
    ${'~> 1.0.0'}      | ${'1.1.0'}       | ${false}
    ${'~> 1.0.7'}      | ${'1.0.4'}       | ${false}
    ${'~> 1.0.7'}      | ${'1.0.7'}       | ${true}
    ${'~> 1.0.7'}      | ${'1.0.8'}       | ${true}
    ${'~> 1.0.7'}      | ${'1.0.7.5'}     | ${true}
    ${'~> 1.0.7'}      | ${'1.0.6.99'}    | ${false}
    ${'~> 1.0.7'}      | ${'1.0.8.0'}     | ${true}
    ${'~> 1.0.9.5'}    | ${'1.0.9.5'}     | ${true}
    ${'~> 1.0.9.5'}    | ${'1.0.9.4'}     | ${false}
    ${'~> 1.0.9.5'}    | ${'1.0.9.6'}     | ${true}
    ${'~> 1.0.9.5'}    | ${'1.0.9.5.0'}   | ${true}
    ${'~> 1.0.9.5'}    | ${'1.0.9.5.1'}   | ${true}
    ${'~> 2.0'}        | ${'2.1.0-beta'}  | ${false}
    ${'~> 2.1.0-a'}    | ${'2.2.0'}       | ${false}
    ${'~> 2.1.0-a'}    | ${'2.1.0'}       | ${false}
    ${'~> 2.1.0-a'}    | ${'2.1.0-beta'}  | ${true}
    ${'~> 2.1.0-a'}    | ${'2.2.0-alpha'} | ${false}
    ${'> 2.0'}         | ${'2.1.0-beta'}  | ${false}
    ${'>= 2.1.0-a'}    | ${'2.1.0-beta'}  | ${true}
    ${'>= 2.1.0-a'}    | ${'2.1.1-beta'}  | ${false}
    ${'>= 2.0.0'}      | ${'2.1.0-beta'}  | ${false}
    ${'>= 2.1.0-a'}    | ${'2.1.1'}       | ${true}
    ${'>= 2.1.0-a'}    | ${'2.1.1-beta'}  | ${false}
    ${'>= 2.1.0-a'}    | ${'2.1.0'}       | ${true}
    ${'<= 2.1.0-a'}    | ${'2.0.0'}       | ${true}
  `(
    '"$range".check("$version") === $expected',
    ({ range, version, expected }) => {
      const constraints = new Constraints(range);
      const parsedVersion = new Version(version);
      expect(constraints.check(parsedVersion)).toBe(expected);
    },
  );

  // TestConstraint_sort
  // Small modification to expected results: whitespace behind ','
  it.each`
    input                          | expected
    ${'>= 0.1.0,< 1.12'}           | ${'< 1.12, >= 0.1.0'}
    ${'< 1.12,>= 0.1.0'}           | ${'< 1.12, >= 0.1.0'}
    ${'< 1.12,>= 0.1.0,0.2.0'}     | ${'< 1.12, 0.2.0, >= 0.1.0'}
    ${'>1.0,>0.1.0,>0.3.0,>0.2.0'} | ${'>0.1.0, >0.2.0, >0.3.0, >1.0'}
  `('"$input".sort().toString() === $expected', ({ input, expected }) => {
    const inputConstraints = new Constraints(input);
    inputConstraints.sort();
    expect(inputConstraints.toString()).toBe(expected);
  });

  // TestConstraintsString
  // Small modification to expected results: whitespace behind ','
  it.each`
    input             | expected
    ${'>= 1.0,< 1.2'} | ${'>= 1.0, < 1.2'}
    ${'~> 1.0.7'}     | ${'~> 1.0.7'}
  `('"$input".toString() === $expected', ({ input, expected }) => {
    const inputConstraints = new Constraints(input);
    expect(inputConstraints.toString()).toBe(expected);
  });
});
