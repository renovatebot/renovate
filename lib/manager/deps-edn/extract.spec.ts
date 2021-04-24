import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const depsEdn = loadFixture(__filename, 'deps.edn');

describe(getName(__filename), () => {
  it('extractPackageFile', () => {
    expect(extractPackageFile(depsEdn)).toMatchSnapshot();
  });
});
