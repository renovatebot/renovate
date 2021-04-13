// eslint-disable-next-line import/no-extraneous-dependencies
import RE2 from 're2';
import { getName } from '../../test/util';
import { CONFIG_VALIDATION } from '../constants/error-messages';
import { regEx } from './regex';

describe(getName(__filename), () => {
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

    const regex = require('./regex');
    expect(regex.regEx('foo')).toBeInstanceOf(RegExp);
  });
});
