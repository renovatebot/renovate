import { regEx } from '../../util/regex';
import { fileMatch } from './file-match';

describe('modules/manager/file-match', () => {
  test.each`
    regex              | expected
    ${/foobar/}        | ${'foobar'}
    ${/(foo)bar(baz)/} | ${'(?:foo)bar(?:baz)'}
  `("fileMatch($regex) -> '$expected'", ({ regex, expected }) => {
    const [source] = fileMatch(regex);
    expect(source).toBe(expected);
    expect(() => regEx(source)).not.toThrow();
  });
});
