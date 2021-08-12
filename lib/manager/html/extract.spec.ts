import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from '.';

const sample = loadFixture(`sample.html`);
const nothing = loadFixture(`nothing.html`);

describe(getName(), () => {
  it('extractPackageFile', () => {
    // FIXME: explicit assert condition
    expect(extractPackageFile(sample)).toMatchSnapshot();
  });
  it('returns null', () => {
    expect(extractPackageFile(nothing)).toBeNull();
  });
});
