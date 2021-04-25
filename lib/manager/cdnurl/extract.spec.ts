import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from '.';

const input = loadFixture(__filename, `sample.txt`);

describe(getName(__filename), () => {
  it('extractPackageFile', () => {
    expect(extractPackageFile(input)).toMatchSnapshot();
  });
});
