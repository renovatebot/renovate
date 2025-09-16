import { extractPackageFile } from './extract';

describe('modules/manager/typst/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns empty deps for empty content', () => {
      const result = extractPackageFile('');
      expect(result).toEqual({ deps: [] });
    });

    it('returns empty deps when no imports found', () => {
      const content = `
        #set page(width: 10cm, height: auto)
        #set text(font: "Linux Libertine")
        = Introduction
        This is a document without any imports.
      `;
      const result = extractPackageFile(content);
      expect(result).toEqual({ deps: [] });
    });

    it('extracts single import', () => {
      const content = '#import "@preview/example:1.0.0": *';
      const result = extractPackageFile(content);
      expect(result).toEqual({
        deps: [
          {
            datasource: 'typst',
            depName: 'example',
            packageName: 'preview/example',
            currentValue: '1.0.0',
          },
        ],
      });
    });

    it('extracts multiple imports', () => {
      const content = `
        #import "@preview/tablex:0.0.8": tablex, gridx
        #import "@preview/cetz:0.2.2": canvas, plot
        #import "@local/mylib:1.2.3": helper
      `;
      const result = extractPackageFile(content);
      expect(result).toEqual({
        deps: [
          {
            datasource: 'typst',
            depName: 'tablex',
            packageName: 'preview/tablex',
            currentValue: '0.0.8',
          },
          {
            datasource: 'typst',
            depName: 'cetz',
            packageName: 'preview/cetz',
            currentValue: '0.2.2',
          },
          {
            datasource: 'typst',
            packageName: 'local/mylib',
            currentValue: '1.2.3',
            skipReason: 'local',
          },
        ],
      });
    });

    it('handles imports with different version formats', () => {
      const content = `
        #import "@preview/pkg1:1.0.0": *
        #import "@preview/pkg2:0.1.0-beta.1": *
        #import "@preview/pkg3:2.1.0-alpha": *
      `;
      const result = extractPackageFile(content);
      expect(result).toEqual({
        deps: [
          {
            datasource: 'typst',
            depName: 'pkg1',
            packageName: 'preview/pkg1',
            currentValue: '1.0.0',
          },
          {
            datasource: 'typst',
            depName: 'pkg2',
            packageName: 'preview/pkg2',
            currentValue: '0.1.0-beta.1',
          },
          {
            datasource: 'typst',
            depName: 'pkg3',
            packageName: 'preview/pkg3',
            currentValue: '2.1.0-alpha',
          },
        ],
      });
    });

    it('strips JSON comments before parsing', () => {
      const content = `
        // This is a comment
        #import "@preview/example:1.0.0": *
        /* Multi-line
           comment */
        #import "@preview/another:2.0.0": *
      `;
      const result = extractPackageFile(content);
      expect(result).toEqual({
        deps: [
          {
            datasource: 'typst',
            depName: 'example',
            packageName: 'preview/example',
            currentValue: '1.0.0',
          },
          {
            datasource: 'typst',
            depName: 'another',
            packageName: 'preview/another',
            currentValue: '2.0.0',
          },
        ],
      });
    });

    it('handles multiple imports on same line', () => {
      const content =
        '#import "@preview/pkg1:1.0.0": * #import "@preview/pkg2:2.0.0": *';
      const result = extractPackageFile(content);
      expect(result).toEqual({
        deps: [
          {
            datasource: 'typst',
            depName: 'pkg1',
            packageName: 'preview/pkg1',
            currentValue: '1.0.0',
          },
          {
            datasource: 'typst',
            depName: 'pkg2',
            packageName: 'preview/pkg2',
            currentValue: '2.0.0',
          },
        ],
      });
    });

    it('ignores invalid import formats', () => {
      const content = `
        #import "regular/path": *
        import "@preview/pkg:1.0.0": *
        #import @preview/pkg:1.0.0: *
        #import "@preview/valid:1.0.0": *
      `;
      const result = extractPackageFile(content);
      expect(result).toEqual({
        deps: [
          {
            datasource: 'typst',
            depName: 'valid',
            packageName: 'preview/valid',
            currentValue: '1.0.0',
          },
        ],
      });
    });

    it('adds skipReason for non-preview namespaces', () => {
      const content = `
        #import "@preview/valid:1.0.0": *
        #import "@local/local-pkg:2.0.0": *
        #import "@custom/custom-pkg:3.0.0": *
      `;
      const result = extractPackageFile(content);
      expect(result).toEqual({
        deps: [
          {
            datasource: 'typst',
            depName: 'valid',
            packageName: 'preview/valid',
            currentValue: '1.0.0',
          },
          {
            datasource: 'typst',
            packageName: 'local/local-pkg',
            currentValue: '2.0.0',
            skipReason: 'local',
          },
          {
            datasource: 'typst',
            packageName: 'custom/custom-pkg',
            currentValue: '3.0.0',
            skipReason: 'unsupported',
          },
        ],
      });
    });
  });
});
