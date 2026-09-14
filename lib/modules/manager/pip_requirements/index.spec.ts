import { matchRegexOrGlobList } from '../../../util/string-match.ts';
import { defaultConfig } from './index.ts';

describe('modules/manager/pip_requirements/index', () => {
  it('default config file pattern', () => {
    const patterns = defaultConfig.managerFilePatterns;

    expect(matchRegexOrGlobList('requirements.txt', patterns)).toBe(true);
    expect(matchRegexOrGlobList('requirements-dev.txt', patterns)).toBe(true);
    expect(matchRegexOrGlobList('requirements_test.txt', patterns)).toBe(true);
    expect(matchRegexOrGlobList('requirements_test_all.txt', patterns)).toBe(
      true,
    );
    expect(matchRegexOrGlobList('requirements.dev.txt', patterns)).toBe(true);
    expect(matchRegexOrGlobList('requirements-dev.pip', patterns)).toBe(true);
    expect(matchRegexOrGlobList('requirements_test.pip', patterns)).toBe(true);
    expect(matchRegexOrGlobList('requirements_test_all.pip', patterns)).toBe(
      true,
    );
    expect(matchRegexOrGlobList('requirements.dev.pip', patterns)).toBe(true);
  });
});
