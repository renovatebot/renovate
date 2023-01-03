import { hashicorp2npm, npm2hashicorp } from './convertor';

describe('modules/versioning/hashicorp/convertor', () => {
  test.each`
    constraint          | expected
    ${'4.2.0'}          | ${'4.2.0'}
    ${'4.2.0-alpha'}    | ${'4.2.0-alpha'}
    ${'~> 4'}           | ${'>=4'}
    ${'~> v4'}          | ${'>=4'}
    ${'~> 4.0'}         | ${'^4.0'}
    ${'~> 4.0.0'}       | ${'~4.0.0'}
    ${'~> 4.0.1'}       | ${'~4.0.1'}
    ${'~> 4.1'}         | ${'^4.1'}
    ${'~> 4.1.0'}       | ${'~4.1.0'}
    ${'~> 4.1.1'}       | ${'~4.1.1'}
    ${'~> 4.0.0-alpha'} | ${'~4.0.0-alpha'}
    ${'>= 4.0'}         | ${'>=4.0'}
    ${'>= v4.0'}        | ${'>=4.0'}
    ${'>=4.0'}          | ${'>=4.0'}
    ${'<= 4.0'}         | ${'<=4.0'}
    ${'<=4.0'}          | ${'<=4.0'}
    ${'> 4.0'}          | ${'>4.0'}
    ${'< 4.0'}          | ${'<4.0'}
    ${'= 4.0'}          | ${'4.0'}
    ${'> 4.0, < 5.0'}   | ${'>4.0 <5.0'}
    ${'> 4.0,< 5.0'}    | ${'>4.0 <5.0'}
    ${'~> 2.3.4'}       | ${'~2.3.4'}
  `(
    'hashicorp2npm("$constraint") === $expected',
    ({ constraint, expected }) => {
      expect(hashicorp2npm(constraint)).toBe(expected);
    }
  );

  test('hashicorp2npm doesnt support !=', () => {
    expect(() => hashicorp2npm('!= 4')).toThrow();
  });

  test('hashicorp2npm throws on invalid', () => {
    expect(() => hashicorp2npm('^4')).toThrow();
  });

  test.each`
    expected              | constraint
    ${'4.2.0'}            | ${'4.2.0'}
    ${'4.2.0-alpha'}      | ${'4.2.0-alpha'}
    ${'4.0'}              | ${'4.0'}
    ${'~> 4.0'}           | ${'^4'}
    ${'~> 4.0'}           | ${'^4.0'}
    ${'~> 4.0'}           | ${'^4.0.0'}
    ${'~> 4.1'}           | ${'^4.1'}
    ${'~> 4.1'}           | ${'^4.1.0'}
    ${'~> 4.1, >= 4.1.1'} | ${'^4.1.1'}
    ${'~> 4.0'}           | ${'~4'}
    ${'~> 4.0.0'}         | ${'~4.0'}
    ${'~> 4.0.0'}         | ${'~4.0.0'}
    ${'~> 4.0.1'}         | ${'~4.0.1'}
    ${'~> 4.1.0'}         | ${'~4.1.0'}
    ${'~> 4.1.1'}         | ${'~4.1.1'}
    ${'~> 4.0.0-alpha'}   | ${'~4.0.0-alpha'}
    ${'>= 4.0'}           | ${'>=4.0'}
    ${'<= 4.0'}           | ${'<=4.0'}
    ${'> 4.0'}            | ${'>4.0'}
    ${'< 4.0'}            | ${'<4.0'}
    ${'> 4.0, < 5.0'}     | ${'>4.0 <5.0'}
    ${'~> 2.3.4'}         | ${'~2.3.4'}
  `(
    'npm2hashicorp("$constraint") === $expected',
    ({ expected, constraint }) => {
      expect(npm2hashicorp(constraint)).toBe(expected);
    }
  );

  test('npm2hashicorp throws on unsupported', () => {
    expect(() => npm2hashicorp('4.x.x')).toThrow();
  });
});
