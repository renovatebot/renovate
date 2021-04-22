import { readFileSync } from 'fs';
import { resolve } from 'upath';
import { testName } from '../../../test/util';
import { extractPackageFile } from '.';

const sample = readFileSync(
  resolve(__dirname, `./__fixtures__/sample.html`),
  'utf8'
);
const nothing = readFileSync(
  resolve(__dirname, `./__fixtures__/nothing.html`),
  'utf8'
);

describe(testName(), () => {
  it('extractPackageFile', () => {
    expect(extractPackageFile(sample)).toMatchSnapshot();
  });
  it('returns null', () => {
    expect(extractPackageFile(nothing)).toBeNull();
  });
});
