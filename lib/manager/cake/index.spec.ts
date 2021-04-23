import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from '.';

const content = loadFixture(__filename, 'build.cake');

describe(getName(__filename), () => {
  it('extracts', () => {
    expect(extractPackageFile(content)).toMatchSnapshot();
  });
});
