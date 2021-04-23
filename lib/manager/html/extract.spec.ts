import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from '.';

const sample = loadFixture(__filename, `sample.html`);
const nothing = loadFixture(__filename, `nothing.html`);

describe(getName(__filename), () => {
  it('extractPackageFile', () => {
    expect(extractPackageFile(sample)).toMatchSnapshot();
  });
  it('returns null', () => {
    expect(extractPackageFile(nothing)).toBeNull();
  });
});
