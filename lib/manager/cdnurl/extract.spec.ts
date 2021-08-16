import { loadFixture } from '../../../test/util';
import { extractPackageFile } from '.';

const input = loadFixture(`sample.txt`);

describe('manager/cdnurl/extract', () => {
  it('extractPackageFile', () => {
    // FIXME: explicit assert condition
    expect(extractPackageFile(input)).toMatchSnapshot();
  });
});
