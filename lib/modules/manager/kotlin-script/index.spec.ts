import { regEx } from '../../../util/regex.ts';
import { isRegexMatch } from '../../../util/string-match.ts';
import { defaultConfig } from './index.ts';

describe('modules/manager/kotlin-script/index', () => {
  it('managerFilePatterns regex is correct', () => {
    expect(defaultConfig.managerFilePatterns).toHaveLength(1);
    const [pattern] = defaultConfig.managerFilePatterns;
    expect(isRegexMatch(pattern)).toBeTrue();
    expect(() => regEx(pattern)).not.toThrow();
  });
});
