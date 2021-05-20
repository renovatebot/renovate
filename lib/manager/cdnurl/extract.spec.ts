import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from '.';

const input = loadFixture(`sample.txt`);

describe(getName(), () => {
  it('extractPackageFile', () => {
    expect(extractPackageFile(input)).toMatchSnapshot();
  });
});
