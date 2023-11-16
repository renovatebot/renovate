import { regEx } from '../../../../util/regex';
import * as utils from './utils';

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
});
