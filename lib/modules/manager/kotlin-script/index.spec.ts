import { regEx } from '../../../util/regex';
import { defaultConfig } from './index';

describe('modules/manager/kotlin-script/index', () => {
  it('fileMatch regex is correct', () => {
    defaultConfig.fileMatch.forEach((pattern) => {
      regEx(pattern);
    });
  });
});
