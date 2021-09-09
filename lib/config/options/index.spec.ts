import { getOptions } from '.';

jest.mock('../../manager', () => ({
  getManagers: jest.fn(() => new Map().set('testManager', {})),
}));

describe('config/options/index', () => {
  it('test manager should have no defaultConfig', () => {
    const opts = getOptions();
    expect(opts.filter((o) => o.name === 'testManager')).toEqual([]);
  });
});
