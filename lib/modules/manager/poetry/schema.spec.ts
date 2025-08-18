import { PoetrySection, PoetrySources } from './schema';

describe('modules/manager/poetry/schema', () => {
  it('parses project version', () => {
    expect(PoetrySection.parse({ version: '1.2.3' }).version).toBe('1.2.3');

    expect(
      PoetrySection.parse({ version: { some: 'value' } }).version,
    ).toBeUndefined();
  });

  describe('PoetrySources', () => {
    it('parses default values', () => {
      expect(PoetrySources.parse([])).toBeEmptyArray();
      expect(PoetrySources.parse([null])).toBeEmptyArray();
    });

    it('parses unordered sources', () => {
      expect(
        PoetrySources.parse([
          { name: 'missing-url' },
          { name: 'missing-priority', url: 'https://some-source.com' },
          {
            name: 'foo-Secondary',
            priority: 'secondary',
            url: 'https://some-vcs.com/secondary',
          },
          { name: 'PyPI', priority: 'primary' },
          {
            name: 'foo-Primary',
            priority: 'primary',
            url: 'https://some-vcs.com/primary',
          },
          {
            name: 'foo-Default',
            priority: 'default',
            url: 'https://some-vcs.com/default',
          },
          {
            name: 'foo-Explicit',
            priority: 'explicit',
            url: 'https://some-vcs.com/explicit',
          },
          {
            name: 'foo-Supplemental',
            priority: 'supplemental',
            url: 'https://some-vcs.com/supplemental',
          },
        ]),
      ).toEqual([
        {
          name: 'foo-default',
          priority: 'default',
          url: 'https://some-vcs.com/default',
        },
        {
          name: 'missing-priority',
          priority: 'primary',
          url: 'https://some-source.com',
        },
        {
          name: 'pypi',
          priority: 'primary',
          url: 'https://pypi.org/pypi/',
        },
        {
          name: 'foo-primary',
          priority: 'primary',
          url: 'https://some-vcs.com/primary',
        },
        {
          name: 'foo-secondary',
          priority: 'secondary',
          url: 'https://some-vcs.com/secondary',
        },
        {
          name: 'foo-supplemental',
          priority: 'supplemental',
          url: 'https://some-vcs.com/supplemental',
        },
        {
          name: 'foo-explicit',
          priority: 'explicit',
          url: 'https://some-vcs.com/explicit',
        },
      ]);
    });

    it('implicit use of PyPI source', () => {
      expect(
        PoetrySources.parse([
          {
            name: 'foo-Supplemental',
            priority: 'supplemental',
            url: 'https://some-vcs.com/supplemental',
          },
        ]),
      ).toEqual([
        {
          name: 'pypi',
          priority: 'default',
          url: 'https://pypi.org/pypi/',
        },
        {
          name: 'foo-supplemental',
          priority: 'supplemental',
          url: 'https://some-vcs.com/supplemental',
        },
      ]);

      expect(
        PoetrySources.parse([
          {
            name: 'foo-Primary',
            priority: 'primary',
            url: 'https://some-vcs.com/primary',
          },
        ]),
      ).toEqual([
        {
          name: 'foo-primary',
          priority: 'primary',
          url: 'https://some-vcs.com/primary',
        },
        {
          name: 'pypi',
          priority: 'secondary',
          url: 'https://pypi.org/pypi/',
        },
      ]);
    });

    it('source with priority="default"', () => {
      expect(
        PoetrySources.parse([
          {
            name: 'foo',
            priority: 'default',
            url: 'https://foo.bar/simple/',
          },
        ]),
      ).toEqual([
        {
          name: 'foo',
          priority: 'default',
          url: 'https://foo.bar/simple/',
        },
      ]);
    });

    it('PyPI source with priority="default"', () => {
      expect(
        PoetrySources.parse([
          {
            name: 'PyPI',
            priority: 'default',
          },
        ]),
      ).toEqual([
        {
          name: 'pypi',
          priority: 'default',
          url: 'https://pypi.org/pypi/',
        },
      ]);
    });

    it('source with priority="primary"', () => {
      expect(
        PoetrySources.parse([
          {
            name: 'foo',
            priority: 'primary',
            url: 'https://foo.bar/simple/',
          },
        ]),
      ).toEqual([
        {
          name: 'foo',
          priority: 'primary',
          url: 'https://foo.bar/simple/',
        },
        {
          name: 'pypi',
          priority: 'secondary',
          url: 'https://pypi.org/pypi/',
        },
      ]);
    });

    it('source with implicit priority="primary"', () => {
      expect(
        PoetrySources.parse([
          {
            name: 'foo',
            url: 'https://foo.bar/simple/',
          },
        ]),
      ).toEqual([
        {
          name: 'foo',
          priority: 'primary',
          url: 'https://foo.bar/simple/',
        },
        {
          name: 'pypi',
          priority: 'secondary',
          url: 'https://pypi.org/pypi/',
        },
      ]);
    });

    it('sources with priority="secondary"', () => {
      expect(
        PoetrySources.parse([
          {
            name: 'foo',
            priority: 'secondary',
            url: 'https://foo.bar/simple/',
          },
          {
            name: 'bar',
            priority: 'secondary',
            url: 'https://bar.baz/simple/',
          },
        ]),
      ).toEqual([
        {
          name: 'pypi',
          priority: 'default',
          url: 'https://pypi.org/pypi/',
        },
        {
          name: 'foo',
          priority: 'secondary',
          url: 'https://foo.bar/simple/',
        },
        {
          name: 'bar',
          priority: 'secondary',
          url: 'https://bar.baz/simple/',
        },
      ]);
    });

    it('unordered sources and implicit PyPI priority="primary"', () => {
      expect(
        PoetrySources.parse([
          {
            name: 'foo',
            priority: 'secondary',
            url: 'https://foo.bar/simple/',
          },
          {
            name: 'bar',
            url: 'https://bar.baz/simple/',
          },
          {
            name: 'PyPI',
          },
          {
            name: 'baz',
            url: 'https://baz.bar/simple/',
          },
        ]),
      ).toEqual([
        {
          name: 'bar',
          priority: 'primary',
          url: 'https://bar.baz/simple/',
        },
        {
          name: 'pypi',
          priority: 'primary',
          url: 'https://pypi.org/pypi/',
        },
        {
          name: 'baz',
          priority: 'primary',
          url: 'https://baz.bar/simple/',
        },
        {
          name: 'foo',
          priority: 'secondary',
          url: 'https://foo.bar/simple/',
        },
      ]);
    });

    it('unordered sources with implicit PyPI priority="secondary"', () => {
      expect(
        PoetrySources.parse([
          {
            name: 'foo',
            priority: 'secondary',
            url: 'https://foo.bar/simple/',
          },
          {
            name: 'bar',
            url: 'https://bar.baz/simple/',
          },
        ]),
      ).toEqual([
        {
          name: 'bar',
          priority: 'primary',
          url: 'https://bar.baz/simple/',
        },
        {
          name: 'foo',
          priority: 'secondary',
          url: 'https://foo.bar/simple/',
        },
        {
          name: 'pypi',
          priority: 'secondary',
          url: 'https://pypi.org/pypi/',
        },
      ]);
    });

    it('source with priority="supplemental"', () => {
      expect(
        PoetrySources.parse([
          {
            name: 'supplemental',
            priority: 'supplemental',
            url: 'https://supplemental.com/simple/',
          },
        ]),
      ).toEqual([
        {
          name: 'pypi',
          priority: 'default',
          url: 'https://pypi.org/pypi/',
        },
        {
          name: 'supplemental',
          priority: 'supplemental',
          url: 'https://supplemental.com/simple/',
        },
      ]);
    });

    it('source with priority="explicit"', () => {
      expect(
        PoetrySources.parse([
          {
            name: 'explicit',
            priority: 'explicit',
            url: 'https://explicit.com/simple/',
          },
        ]),
      ).toEqual([
        {
          name: 'pypi',
          priority: 'default',
          url: 'https://pypi.org/pypi/',
        },
        {
          name: 'explicit',
          priority: 'explicit',
          url: 'https://explicit.com/simple/',
        },
      ]);
    });
  });
});
