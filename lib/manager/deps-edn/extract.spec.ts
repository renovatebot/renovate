import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const depsEdn = loadFixture('deps.edn');

describe(getName(), () => {
  it('extractPackageFile', () => {
    // FIXME: explicit assert condition
    expect(extractPackageFile(depsEdn)).toMatchSnapshot();
  });
});
