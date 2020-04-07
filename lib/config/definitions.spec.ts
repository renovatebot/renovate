import { getOptions } from './definitions';
import { getName } from '../../test/util';

jest.mock('../manager', () => ({
  getManagers: jest.fn(() => new Map().set('testManager', {})),
}));

describe(getName(__filename), () => {
  it('test manager should have no defaultConfig', () => {
    const opts = getOptions();
    expect(opts.filter(o => o.name === 'testManager')).toEqual([]);
  });
});
