import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from '.';

const sample = loadFixture(`sample.html`);
const nothing = loadFixture(`nothing.html`);

describe(getName(), () => {
  it('extractPackageFile', () => {
    expect(extractPackageFile(sample)).toMatchSnapshot();
  });
  it('returns null', () => {
    expect(extractPackageFile(nothing)).toBeNull();
  });
});
