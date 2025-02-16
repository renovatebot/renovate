import aws from '.';

describe('modules/versioning/aws-eks-addon/index', () => {
  describe('parse(version)', () => {
    it('should return 1.23.7 and release version', () => {
      expect(aws.getMajor('v1.20.7-eksbuild.1')).toBe(1);
      expect(aws.getMinor('v1.23.7-eksbuild.1')).toBe(23);
      expect(aws.getPatch('v1.20.7-eksbuild.1')).toBe(7);
    });
  });

  describe('isValid(version)', () => {
    it.each`
      input                      | expected
      ${''}                      | ${false}
      ${'.1..'}                  | ${false}
      ${'abrakadabra'}           | ${false}
      ${'v1'}                    | ${false}
      ${'v1.'}                   | ${false}
      ${'v1...-eksbuild.1'}      | ${false}
      ${'v1-eksbuild.1'}         | ${false}
      ${'v1.a-eksbuild.1'}       | ${false}
      ${'v1.23-eksbuild.1'}      | ${false}
      ${'1.23.1-eksbuild.a'}     | ${false}
      ${'v1.11.7'}               | ${false}
      ${'v1.11.7.6'}             | ${false}
      ${'v1.11.7-noneksbuild'}   | ${false}
      ${'v1.11.7-noneksbuild.1'} | ${false}
      ${'v1.11.7-eksbuild'}      | ${false}
      ${'v1.11.7.3-eksbuild.1'}  | ${false}
      ${'v1.23.1-eksbuild.1'}    | ${true}
      ${'1.23.1-eksbuild.1'}     | ${true}
      ${'v1.23.1-eksbuild.11'}   | ${true}
    `('isValid("$input") === $expected', ({ input, expected }) => {
      const actual = aws.isValid(input);
      expect(actual).toBe(expected);
    });
  });

  describe('isVersion(version)', () => {
    it.each`
      input                      | expected
      ${''}                      | ${false}
      ${'abrakadabra'}           | ${false}
      ${'v1'}                    | ${false}
      ${'v1.'}                   | ${false}
      ${'v1-eksbuild.1'}         | ${false}
      ${'v1.a-eksbuild.1'}       | ${false}
      ${'v1.23-eksbuild.1'}      | ${false}
      ${'1.23.1-eksbuild.a'}     | ${false}
      ${'v1.11.7'}               | ${false}
      ${'v1.11.7.6'}             | ${false}
      ${'v1.11.7-noneksbuild'}   | ${false}
      ${'v1.11.7-noneksbuild.1'} | ${false}
      ${'v1.11.7-eksbuild'}      | ${false}
      ${'v1.11.7.3-eksbuild.1'}  | ${false}
      ${'v1.23.1-eksbuild.1'}    | ${true}
      ${'1.23.1-eksbuild.1'}     | ${true}
      ${'v1.23.1-eksbuild.11'}   | ${true}
    `('isValid("$input") === $expected', ({ input, expected }) => {
      const actual = aws.isVersion(input);
      expect(actual).toBe(expected);
    });
  });

  describe('isCompatible(version)', () => {
    it.each`
      input                      | expected
      ${''}                      | ${false}
      ${'abrakadabra'}           | ${false}
      ${'v1'}                    | ${false}
      ${'v1.'}                   | ${false}
      ${'v1-eksbuild.1'}         | ${false}
      ${'v1.a-eksbuild.1'}       | ${false}
      ${'v1.23-eksbuild.1'}      | ${false}
      ${'1.23.1-eksbuild.1'}     | ${false}
      ${'1.23.1-eksbuild.a'}     | ${false}
      ${'v1.11.7'}               | ${false}
      ${'v1.11.7.6'}             | ${false}
      ${'v1.11.7-noneksbuild'}   | ${false}
      ${'v1.11.7-noneksbuild.1'} | ${false}
      ${'v1.11.7-eksbuild'}      | ${false}
      ${'v1.11.7.3-eksbuild.1'}  | ${false}
    `('isCompatible("$input") === $expected', ({ input, expected }) => {
      const actual = aws.isCompatible(input);
      expect(actual).toBe(expected);
    });
  });

  describe('isCompatible(version,range)', () => {
    it.each`
      version                   | current                    | expected
      ${'1.23.1-eksbuild.1'}    | ${'1.23.1-eksbuild.2'}     | ${true}
      ${'v1.23.1-eksbuild.1'}   | ${'1.23.1-eksbuild.2'}     | ${true}
      ${'v1.23.1-eksbuild.1'}   | ${'1.23.1-eksbuild.21'}    | ${true}
      ${'v1.11.7-eksbuild.1'}   | ${'v1.11.7-noneksbuild.1'} | ${false}
      ${'v1.11.7'}              | ${'v1.11.7-noneksbuild.1'} | ${false}
      ${'v1-eksbuild.1'}        | ${'artful'}                | ${false}
      ${'v1.11.7.1-eksbuild.1'} | ${'v1.11.7-eksbuild.1'}    | ${false}
    `(
      'isCompatible($version, $current) === $expected',
      ({ version, current, expected }) => {
        const actual = aws.isCompatible(version, current);
        expect(actual).toBe(expected);
      },
    );
  });

  describe('isGreaterThan(version1, version2)', () => {
    it.each`
      version                  | other                   | expected
      ${'v1.11.7-eksbuild.1'}  | ${'v1.11.7-eksbuild.0'} | ${true}
      ${'v1.11.7-eksbuild.11'} | ${'v1.11.7-eksbuild.1'} | ${true}
      ${'v1.22.7-eksbuild.2'}  | ${'v1.20.7-eksbuild.1'} | ${true}
      ${'v1.22.7-eksbuild.2'}  | ${'v1.22.7'}            | ${true}
      ${'v1.20.7-eksbuild.1'}  | ${'v2.0.0'}             | ${true}
      ${'v1.20.7-eksbuild.1'}  | ${'v1.20.7-eksbuild.2'} | ${false}
      ${'v1.20.6-eksbuild.1'}  | ${'v1.20.7-eksbuild.2'} | ${false}
      ${'v1.20.7-eksbuild.1'}  | ${'v2.0.0-eksbuild.1'}  | ${false}
    `(
      'isGreaterThan($version, $other) === $expected',
      ({ version, other, expected }) => {
        const actual = aws.isGreaterThan(version, other);
        expect(actual).toBe(expected);
      },
    );
  });

  it('getSatisfyingVersion', () => {
    expect(
      aws.getSatisfyingVersion(['v1.20.7-eksbuild.1'], 'v1.20.7-eksbuild.1'),
    ).toBe('v1.20.7-eksbuild.1');
    expect(
      aws.getSatisfyingVersion(
        ['v1.20.7-eksbuild.1', 'v1.20.7-eksbuild.2', 'v1.20.7-eksbuild.7'],
        'v1.20.7-eksbuild.3',
      ),
    ).toBeNull();
    expect(
      aws.getSatisfyingVersion(
        ['v1.20.7-eksbuild.1', 'v1.20.7-eksbuild.2'],
        'v1.20.7-eksbuild.3',
      ),
    ).toBeNull();
  });
});
