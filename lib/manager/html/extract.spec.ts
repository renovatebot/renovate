import { readFileSync } from 'fs';
import { resolve } from 'upath';
import { extractPackageFile } from '.';

const sample = readFileSync(
  resolve(__dirname, `./__fixtures__/sample.html`),
  'utf8'
);
const nothing = readFileSync(
  resolve(__dirname, `./__fixtures__/nothing.html`),
  'utf8'
);

describe('manager/html/extract', () => {
  it('extractPackageFile', () => {
    expect(extractPackageFile(sample)).toMatchSnapshot();
  });
  it('returns null', () => {
    expect(extractPackageFile(nothing)).toBeNull();
  });
});
