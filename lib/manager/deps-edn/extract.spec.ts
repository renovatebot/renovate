import { loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const depsEdn = loadFixture('deps.edn');

describe('manager/deps-edn/extract', () => {
  it('extractPackageFile', () => {
    // FIXME: explicit assert condition
    expect(extractPackageFile(depsEdn)).toMatchSnapshot();
  });
});
