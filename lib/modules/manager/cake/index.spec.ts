import { extractPackageFile } from '.';
import { Fixtures } from '~test/fixtures';

describe('modules/manager/cake/index', () => {
  it('extracts', () => {
    expect(extractPackageFile(Fixtures.get('build.cake'))).toMatchObject({
      deps: [
        { depName: 'Foo.Foo', currentValue: undefined },
        { depName: 'Bim.Bim', currentValue: '6.6.6' },
        { depName: 'Bar.Bar', registryUrls: ['https://example.com/'] },
        { depName: 'Cake.Git', registryUrls: ['https://example.com/feed/v3/'] },
        {
          depName: 'Cake.MinVer',
          registryUrls: ['https://example.com/feed/v3/index.json'],
        },
        { depName: 'Baz.Baz', skipReason: 'unsupported-url' },
        { depName: 'Cake.7zip', currentValue: '1.0.3' },
        { depName: 'Cake.asciidoctorj', currentValue: '1.0.0' },
      ],
    });
  });
});
