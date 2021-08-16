import { getOptions } from './definitions';

jest.mock('../manager', () => ({
  getManagers: jest.fn(() => new Map().set('testManager', {})),
}));

describe('config/definitions', () => {
  it('test manager should have no defaultConfig', () => {
    const opts = getOptions();
    expect(opts.filter((o) => o.name === 'testManager')).toEqual([]);
  });
});
