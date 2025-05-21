import { regEx } from '../../../util/regex';
import { isRegexMatch } from '../../../util/string-match';
import { defaultConfig } from '.';

describe('modules/manager/kotlin-script/index', () => {
  it('managerFilePatterns regex is correct', () => {
    expect(defaultConfig.managerFilePatterns).toHaveLength(1);
    defaultConfig.managerFilePatterns.forEach((pattern) => {
      if (isRegexMatch(pattern)) {
        expect(() => regEx(pattern)).not.toThrow();
      }
    });
  });
});
