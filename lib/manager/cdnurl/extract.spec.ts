import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from '.';

const input = loadFixture(`sample.txt`);

describe(getName(), () => {
  it('extractPackageFile', () => {
    // FIXME: explicit assert condition
    expect(extractPackageFile(input)).toMatchSnapshot();
  });
});
