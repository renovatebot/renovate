import * as cache from './cache';

describe('workers/repository/extract/cache', () => {
  const config = { baseBranch: 'master', baseBranchSha: 'abc123' };
  const extractList = [];
  const extraction = { foo: [] };
  it('handles missing sha', () => {
    expect(cache.getExtractHash({}, {})).toBeNull();
  });
  it('returns a hash', () => {
    expect(
      cache.getExtractHash({ baseBranchSha: 'abc123' }, {})
    ).toMatchSnapshot();
  });
  it('sets a value', async () => {
    await cache.setCachedExtract(config, extractList, extraction);
  });
  it('gets no value', async () => {
    extractList.push('abc');
    const res = await cache.getCachedExtract(config, extractList);
    expect(res).toEqual(null);
  });
  it('handles no sha error', async () => {
    const res = await cache.getCachedExtract(
      { baseBranch: 'nothing' },
      extractList
    );
    expect(res).toBeNull();
  });
});
