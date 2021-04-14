import { readFileSync } from 'fs';
import { getName } from '../../../test/util';
import { extractPackageFile } from '.';

const content = readFileSync(
  'lib/manager/cake/__fixtures__/build.cake',
  'utf8'
);

describe(getName(__filename), () => {
  it('extracts', () => {
    expect(extractPackageFile(content)).toMatchSnapshot();
  });
});
