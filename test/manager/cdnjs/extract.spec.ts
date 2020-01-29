import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractPackageFile } from '../../../lib/manager/cdnjs/extract';

const input = readFileSync(
  resolve(__dirname, `./_fixtures/sample.html`),
  'utf8'
);

describe('manager/cdnjs/extract', () => {
  it('extractPackageFile', () => {
    expect(extractPackageFile(input)).toMatchSnapshot();
  });
});
