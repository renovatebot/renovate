import RE2 from 're2';
import { regEx } from '../../lib/util/regex';
import { CONFIG_VALIDATION } from '../../lib/constants/error-messages';

describe('util/regex', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('uses RE2', () => {
    expect(regEx('foo')).toBeInstanceOf(RE2);
  });
  it('throws unsafe 2', () => {
    expect(() => regEx(`x++`)).toThrow(CONFIG_VALIDATION);
  });

  it('Falls back to RegExp', () => {
    jest.doMock('re2', () => {
      throw new Error();
    });

    const regex = require('../../lib/util/regex');
    expect(regex.regEx('foo')).toBeInstanceOf(RegExp);
  });
});
