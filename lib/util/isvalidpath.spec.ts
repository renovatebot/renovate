import { isValidPath } from './isvalidpath';

describe('util/isvalidpath', () => {
  it('detects invalid paths', () => {
    const testCases = {
      '.': true,
      './...': true,
      foo: true,
      'foo/bar': true,
      './foo/bar': true,
      './foo/bar/...': true,
      '\\foo': false,
      "foo'": false,
      'fo"o': false,
      'fo&o': false,
      'f;oo': false,
      'f o o': false,
    };
    Object.entries(testCases).forEach(([s, expected]) => {
      expect(isValidPath(s)).toBe(expected);
    });
  });
});
