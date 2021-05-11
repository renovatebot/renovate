import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const depsEdn = loadFixture('deps.edn');

describe(getName(), () => {
  it('extractPackageFile', () => {
    expect(extractPackageFile(depsEdn)).toMatchSnapshot();
  });
});
