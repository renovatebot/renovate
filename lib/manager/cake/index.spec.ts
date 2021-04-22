import { readFileSync } from 'fs';
import { testName } from '../../../test/util';
import { extractPackageFile } from '.';

const content = readFileSync(
  'lib/manager/cake/__fixtures__/build.cake',
  'utf8'
);

describe(testName(), () => {
  it('extracts', () => {
    expect(extractPackageFile(content)).toMatchSnapshot();
  });
});
