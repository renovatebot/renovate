import { regEx } from '../../../util/regex';
import { defaultConfig } from '.';

describe('modules/manager/kotlin-script/index', () => {
  it('fileMatch regex is correct', () => {
    expect(defaultConfig.fileMatch).toHaveLength(1);
    defaultConfig.fileMatch.forEach((pattern) => {
      expect(() => regEx(pattern)).not.toThrow();
    });
  });
});
