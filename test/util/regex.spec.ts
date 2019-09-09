import RE2 from 're2';
import { regEx } from '../../lib/util/regex';

describe('util/regex', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('uses RE2', () => {
    expect(regEx('foo') instanceof RE2).toBe(true);
  });
  it('throws unsafe 2', () => {
    expect(() => regEx(`x++`)).toThrow('config-validation');
  });

  it('Falls back to RegExp', () => {
    jest.doMock('re2', () => {
      throw new Error();
    });

    const regex = require('../../lib/util/regex');
    expect(regex.regEx('foo') instanceof RegExp).toBe(true);
  });
});
