import { TokenType } from './common';
import {
  interpolateString,
  isDependencyString,
  parseDependencyString,
  versionLikeSubstring,
} from './utils';

describe('manager/gradle-lite/utils', () => {
  it('versionLikeSubstring', () => {
    [
      '1.2.3',
      'foobar',
      '[1.0,2.0]',
      '(,2.0[',
      '2.1.1.RELEASE',
      '1.0.+',
      'latest',
    ].forEach((input) => {
      expect(versionLikeSubstring(input)).toEqual(input);
      expect(versionLikeSubstring(`${input}'`)).toEqual(input);
      expect(versionLikeSubstring(`${input}"`)).toEqual(input);
      expect(versionLikeSubstring(`${input}\n`)).toEqual(input);
      expect(versionLikeSubstring(`${input}  `)).toEqual(input);
      expect(versionLikeSubstring(`${input}$`)).toEqual(input);
    });
    expect(versionLikeSubstring('')).toBeNull();
    expect(versionLikeSubstring(undefined)).toBeNull();
    expect(versionLikeSubstring(null)).toBeNull();
  });
  it('isDependencyString', () => {
    expect(isDependencyString('foo:bar:1.2.3')).toBe(true);
    expect(isDependencyString('foo.foo:bar.bar:1.2.3')).toBe(true);
    expect(isDependencyString('foo:bar:baz:qux')).toBe(false);
    expect(isDependencyString('foo.bar:baz:1.2.3')).toBe(true);
    expect(isDependencyString('foo.bar:baz:1.2.+')).toBe(true);
    expect(isDependencyString('foo.bar:baz:qux:quux')).toBe(false);
    expect(isDependencyString("foo:bar:1.2.3'")).toBe(false);
    expect(isDependencyString('foo:bar:1.2.3"')).toBe(false);
    expect(isDependencyString('-Xep:ParameterName:OFF')).toBe(false);
  });
  it('parseDependencyString', () => {
    expect(parseDependencyString('foo:bar:1.2.3')).toMatchObject({
      depName: 'foo:bar',
      currentValue: '1.2.3',
    });
    expect(parseDependencyString('foo.foo:bar.bar:1.2.3')).toMatchObject({
      depName: 'foo.foo:bar.bar',
      currentValue: '1.2.3',
    });
    expect(parseDependencyString('foo:bar:baz:qux')).toBeNull();
    expect(parseDependencyString('foo.bar:baz:1.2.3')).toMatchObject({
      depName: 'foo.bar:baz',
      currentValue: '1.2.3',
    });
    expect(parseDependencyString('foo:bar:1.2.+')).toMatchObject({
      depName: 'foo:bar',
      currentValue: '1.2.+',
    });
    expect(parseDependencyString('foo.bar:baz:qux:quux')).toBeNull();
    expect(parseDependencyString("foo:bar:1.2.3'")).toBeNull();
    expect(parseDependencyString('foo:bar:1.2.3"')).toBeNull();
    expect(parseDependencyString('-Xep:ParameterName:OFF')).toBeNull();
  });
  it('interpolateString', () => {
    expect(interpolateString([], {})).toBe('');
    expect(
      interpolateString(
        [
          { type: TokenType.String, value: 'foo' },
          { type: TokenType.Variable, value: 'bar' },
          { type: TokenType.String, value: 'baz' },
        ] as never,
        {
          bar: { value: 'BAR' },
        } as never
      )
    ).toBe('fooBARbaz');
    expect(
      interpolateString(
        [{ type: TokenType.Variable, value: 'foo' }] as never,
        {} as never
      )
    ).toBeNull();
    expect(
      interpolateString(
        [{ type: TokenType.UnknownFragment, value: 'foo' }] as never,
        {} as never
      )
    ).toBeNull();
  });
});
