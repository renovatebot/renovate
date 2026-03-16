import { regEx } from '../../../../util/regex.ts';
import { parseExtractVersionValue } from '../utils.ts';
import * as utils from './utils.ts';

describe('modules/manager/custom/regex/utils', () => {
  it('does not crash for lazy regex', () => {
    const lazyMatch = regEx('(?<currentDigest>.*?)', 'g');
    expect(
      utils.regexMatchAll(
        lazyMatch,
        '1f699d2bfc99bbbe4c1ed5bb8fc21e6911d69c6e\n',
      ),
    ).toBeArray();
  });

  it('parses extractVersion JSON arrays', () => {
    expect(
      parseExtractVersionValue('["^(?<version>.*)$","v{{version}}"]'),
    ).toEqual(['^(?<version>.*)$', 'v{{version}}']);
  });

  it('falls back to legacy single-element array for invalid input', () => {
    expect(parseExtractVersionValue('^v(?<version>.*)$')).toEqual([
      '^v(?<version>.*)$',
    ]);
  });
});
