const cargo = require('../../../lib/datasource/cargo');

describe('cargo datasource', () => {
  beforeEach(() => {
    return global.renovateCache.rmAll();
  });
  it('should use global cache', async () => {
    const dep = {
      name: 'abc123',
    };
    await global.renovateCache.set('datasource-cargo', 'foobar', dep, 10);
    const res = await cargo.getPkgReleases({ lookupName: 'foobar' });
    expect(res).toEqual(dep);
  });
});
