import { regEx } from '../../../util/regex.ts';
import { isRegexMatch } from '../../../util/string-match.ts';
import { defaultConfig } from './index.ts';

describe('modules/manager/kotlin-script/index', () => {
  it('managerFilePatterns regex is correct', () => {
    expect(defaultConfig.managerFilePatterns).toHaveLength(1);
    defaultConfig.managerFilePatterns.forEach((pattern) => {
      if (isRegexMatch(pattern)) {
        // eslint-disable-next-line vitest/no-conditional-expect
        expect(() => regEx(pattern)).not.toThrow();
      }
    });
  });
});
