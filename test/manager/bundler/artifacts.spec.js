const cargo = require('../../../lib/manager/bundler/artifacts');

let config;

describe('bundler.updateArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    config = {};
  });
  it('returns null by default', async () => {
    expect(await cargo.updateArtifacts('', [], '', config)).toBeNull();
  });
});
