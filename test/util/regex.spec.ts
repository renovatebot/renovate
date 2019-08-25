import RE2 from 're2';
import { RegEx } from '../../lib/util/regex';

describe('util/regex', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('uses RE2', () => {
    expect(RegEx).toEqual(RE2);
  });

  it('Falls back to RegExp', () => {
    jest.doMock('re2', () => {
      throw new Error();
    });

    const regex = require('../../lib/util/regex');
    expect(regex.RegEx).toEqual(RegExp);
  });
});
