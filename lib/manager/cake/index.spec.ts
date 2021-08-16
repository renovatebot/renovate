import { loadFixture } from '../../../test/util';
import { extractPackageFile } from '.';

const content = loadFixture('build.cake');

describe('manager/cake/index', () => {
  it('extracts', () => {
    // FIXME: explicit assert condition
    expect(extractPackageFile(content)).toMatchSnapshot();
  });
});
