const datasource = require('../../lib/datasource');

describe('datasource/index', () => {
  it('returns null for invalid purl', async () => {
    expect(await datasource.getDependency('pkggithub/some/dep')).toBeNull();
  });
});
