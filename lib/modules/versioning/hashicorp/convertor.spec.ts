import { hashicorp2npm, npm2hashicorp } from './convertor';

describe('modules/versioning/hashicorp/convertor', () => {
  it.each`
    hashicorp           | npm
    ${''}               | ${''}
    ${'4.2.0'}          | ${'4.2.0'}
    ${'4.2.0-alpha'}    | ${'4.2.0-alpha'}
    ${'~> 4.0'}         | ${'^4.0'}
    ${'~> 4.1'}         | ${'^4.1'}
    ${'~> 4.0.0'}       | ${'~4.0.0'}
    ${'~> 4.0.1'}       | ${'~4.0.1'}
    ${'~> 4.1.0'}       | ${'~4.1.0'}
    ${'~> 4.1.1'}       | ${'~4.1.1'}
    ${'~> 4.0.0-alpha'} | ${'~4.0.0-alpha'}
    ${'>= 4.0'}         | ${'>=4.0'}
    ${'<= 4.0'}         | ${'<=4.0'}
    ${'> 4.0'}          | ${'>4.0'}
    ${'< 4.0'}          | ${'<4.0'}
    ${'> 4.0, < 5.0'}   | ${'>4.0 <5.0'}
    ${'~> 2.3.4'}       | ${'~2.3.4'}
    ${'0.1.0-beta.0'}   | ${'0.1.0-beta.0'}
  `(
    'hashicorp2npm("$hashicorp") === $npm && npm2hashicorp("$npm") === $hashicorp',
    ({ hashicorp, npm }) => {
      expect(hashicorp2npm(hashicorp)).toBe(npm);
      expect(npm2hashicorp(npm)).toBe(hashicorp);
    },
  );

  // These are cases where $hashicorp === $npm
  it.each`
    version
    ${'1.0.0-0'}
    ${'1.0.0-1'}
    ${'1.0.0-1.1'}
    ${'1.0.0-10.21.32'}
    ${'1.0.0-1.alpha.2'}
    ${'1.0.0-alpha.beta'}
    ${'1.0.0-alpha.beta.1'}
    ${'1.0.0-alpha0.valid'}
    ${'1.0.0-alpha.0valid'}
    ${'1.0.0-alpha1test'}
    ${'1.0.0-a.b'}
    ${'1.0.0-a-b'}
    ${'1.0.0-a1.-1-0-.09-9-'}
    ${'1.0.0-a--.b'}
  `(
    'hashicorp2npm("$version") === $version && npm2hashicorp("$version") === $version',
    ({ version }) => {
      expect(hashicorp2npm(version)).toBe(version);
      expect(npm2hashicorp(version)).toBe(version);
    },
  );

  // These are non-reflective cases for hashicorp2npm
  it.each`
    hashicorp        | npm
    ${'~> 4'}        | ${'>=4'}
    ${'~> v4'}       | ${'>=4'}
    ${'>= v4.0'}     | ${'>=4.0'}
    ${'>=4.0'}       | ${'>=4.0'}
    ${'<=4.0'}       | ${'<=4.0'}
    ${'= 4.0'}       | ${'4.0'}
    ${'> 4.0,< 5.0'} | ${'>4.0 <5.0'}
  `('hashicorp2npm("$hashicorp") === $npm', ({ hashicorp, npm }) => {
    expect(hashicorp2npm(hashicorp)).toBe(npm);
  });

  // These are non-reflective cases for npm2hashicorp
  it.each`
    hashicorp     | npm
    ${'~> 4.0'}   | ${'^4'}
    ${'~> 4.0'}   | ${'^4.0.0'}
    ${'~> 4.1'}   | ${'^4.1.0'}
    ${'~> 4.1'}   | ${'^4.1.1'}
    ${'~> 4.0'}   | ${'~4'}
    ${'~> 4.0.0'} | ${'~4.0'}
    ${'~> 4.1.0'} | ${'~4.1'}
    ${'4.1.0'}    | ${'v4.1.0'}
  `('npm2hashicorp("$npm") === $hashicorp', ({ hashicorp, npm }) => {
    expect(npm2hashicorp(npm)).toBe(hashicorp);
  });

  test('hashicorp2npm doesnt support !=', () => {
    expect(() => hashicorp2npm('!= 4')).toThrow();
  });

  test('hashicorp2npm throws on invalid', () => {
    expect(() => hashicorp2npm('^4')).toThrow();
  });

  test('npm2hashicorp throws on unsupported', () => {
    expect(() => npm2hashicorp('4.x.x')).toThrow();
  });
});
