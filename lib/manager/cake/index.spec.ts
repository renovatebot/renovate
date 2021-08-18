import { loadFixture } from '../../../test/util';
import { extractPackageFile } from '.';

const content = loadFixture('build.cake');

describe('manager/cake/index', () => {
  it('extracts', () => {
    expect(extractPackageFile(content)).toMatchSnapshot({
      deps: [
        { depName: 'Foo.Foo', currentValue: '1.1.1' },
        { depName: 'Bim.Bim', currentValue: '6.6.6' },
        { depName: 'Bar.Bar', registryUrls: ['https://example.com'] },
        { depName: 'Baz.Baz', skipReason: 'unsupported-url' },
        { depName: 'Cake.7zip', currentValue: '1.0.3' },
        { depName: 'Cake.asciidoctorj', currentValue: '1.0.0' },
      ],
    });
  });
});
