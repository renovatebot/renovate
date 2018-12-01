// const fs = require('fs');
// const upath = require('upath');
// const cargo = require('../../../lib/manager/cargo/artifacts');
// const { extractPackageFile } = require('../../../lib/manager/cargo/extract');

// const crateDir = 'test/_fixtures/cargo/example_crate';
// const cargoTomlFilePath = upath.join(crateDir, 'Cargo.toml');
// const cargoLockFilePath = upath.join(crateDir, 'Cargo.lock');
// const cargoToml = fs.readFileSync(cargoTomlFilePath, 'utf8');
// const cargoLock = fs.readFileSync(cargoLockFilePath, 'utf8');

// const config = {
//   localDir: '/tmp/github/some/repo',
// };

describe('.getArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it('returns if no Cargo.lock found', async () => {
    // expect(await cargo.getArtifacts('Cargo.toml', [], '', config)).toBeNull();
    // stub
  });
  it('returns null if unchanged', async () => {
    // stub
  });
  it('returns updated composer.lock', async () => {
    // stub
  });
  it('catches errors', async () => {
    // stub
  });
});
