const cargo = require('../../../lib/manager/bundler/artifacts');

let config;

describe('bundler.getArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    config = {};
  });
  it('returns null by default', async () => {
    expect(await cargo.getArtifacts('', [], '', config)).toBeNull();
  });
});
