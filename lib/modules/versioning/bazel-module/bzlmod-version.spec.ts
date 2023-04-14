import { BzlmodVersion } from './bzlmod-version';

describe('modules/versioning/bazel-module/bzlmod-version', () => {
  it('constructor', () => {
    const bzlmodVer = new BzlmodVersion('1.2.3');
    expect(bzlmodVer.release).toHaveLength(3);
  });
});
