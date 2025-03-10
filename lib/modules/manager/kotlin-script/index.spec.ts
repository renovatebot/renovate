import { regEx } from '../../../util/regex';
import { isRegexMatch } from '../../../util/string-match';
import { defaultConfig } from '.';

describe('modules/manager/kotlin-script/index', () => {
  it('filePatterns regex is correct', () => {
    expect(defaultConfig.filePatterns).toHaveLength(1);
    defaultConfig.filePatterns.forEach((pattern) => {
      if (isRegexMatch(pattern)) {
        expect(() => regEx(pattern)).not.toThrow();
      }
    });
  });
});
