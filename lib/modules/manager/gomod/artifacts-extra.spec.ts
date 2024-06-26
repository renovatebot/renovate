import { codeBlock } from 'common-tags';
import {
  extraDepsTable,
  getExtraDeps,
  getExtraDepsNotice,
} from './artifacts-extra';
import type { ExtraDep } from './types';

describe('modules/manager/gomod/artifacts-extra', () => {
  const goModBefore = codeBlock`
    go 1.22.0

    require (
      github.com/foo/foo v1.0.0
      github.com/bar/bar v2.0.0
    )

    replace baz/baz => qux/qux
  `;

  const goModAfter = codeBlock`
    go 1.22.2

    // Note the order change
    require (
      github.com/bar/bar v2.2.2
      github.com/foo/foo v1.1.1
    )

    replace baz/baz => quux/quux
  `;

  describe('getExtraDeps', () => {
    it('detects extra dependencies', () => {
      const excludeDeps = ['github.com/foo/foo'];

      const res = getExtraDeps(goModBefore, goModAfter, excludeDeps);

      expect(res).toEqual([
        {
          depName: 'go',
          currentValue: '1.22.0',
          newValue: '1.22.2',
        },
        {
          depName: 'github.com/bar/bar',
          currentValue: 'v2.0.0',
          newValue: 'v2.2.2',
        },
      ] satisfies ExtraDep[]);
    });
  });

  describe('extraDepsTable', () => {
    it('generates a table', () => {
      const extraDeps: ExtraDep[] = [
        {
          depName: 'github.com/foo/foo',
          currentValue: 'v1.0.0',
          newValue: 'v1.1.1',
        },
        {
          depName: 'github.com/bar/bar',
          currentValue: 'v2.0.0',
          newValue: 'v2.2.2',
        },
      ];

      const res = extraDepsTable(extraDeps);

      expect(res).toEqual(
        [
          '| **Package**          | **Change**           |',
          '| :------------------- | :------------------- |',
          '| `github.com/foo/foo` | `v1.0.0` -> `v1.1.1` |',
          '| `github.com/bar/bar` | `v2.0.0` -> `v2.2.2` |',
        ].join('\n'),
      );
    });
  });

  describe('getExtraDepsNotice', () => {
    it('returns null when one of files is missing', () => {
      expect(getExtraDepsNotice(null, goModAfter, [])).toBeNull();
      expect(getExtraDepsNotice(goModBefore, null, [])).toBeNull();
    });

    it('returns null when all dependencies are excluded', () => {
      const excludeDeps = ['go', 'github.com/foo/foo', 'github.com/bar/bar'];
      const res = getExtraDepsNotice(goModBefore, goModAfter, excludeDeps);
      expect(res).toBeNull();
    });

    it('returns a notice when there is an extra dependency', () => {
      const excludeDeps = ['go', 'github.com/foo/foo'];

      const res = getExtraDepsNotice(goModBefore, goModAfter, excludeDeps);

      expect(res).toEqual(
        [
          'In order to perform the update(s) described in the table above, Renovate ran the `go get` command, which resulted in the following additional change(s):',
          '',
          '',
          '- 1 additional dependency was updated',
          '',
          '',
          'Details:',
          '',
          '',
          '| **Package**          | **Change**           |',
          '| :------------------- | :------------------- |',
          '| `github.com/bar/bar` | `v2.0.0` -> `v2.2.2` |',
        ].join('\n'),
      );
    });

    it('returns a notice when there are extra dependencies', () => {
      const excludeDeps = ['go'];

      const res = getExtraDepsNotice(goModBefore, goModAfter, excludeDeps);

      expect(res).toEqual(
        [
          'In order to perform the update(s) described in the table above, Renovate ran the `go get` command, which resulted in the following additional change(s):',
          '',
          '',
          '- 2 additional dependencies were updated',
          '',
          '',
          'Details:',
          '',
          '',
          '| **Package**          | **Change**           |',
          '| :------------------- | :------------------- |',
          '| `github.com/foo/foo` | `v1.0.0` -> `v1.1.1` |',
          '| `github.com/bar/bar` | `v2.0.0` -> `v2.2.2` |',
        ].join('\n'),
      );
    });

    it('adds special notice for updated `go` version', () => {
      const excludeDeps = ['github.com/foo/foo'];

      const res = getExtraDepsNotice(goModBefore, goModAfter, excludeDeps);

      expect(res).toEqual(
        [
          'In order to perform the update(s) described in the table above, Renovate ran the `go get` command, which resulted in the following additional change(s):',
          '',
          '',
          '- 1 additional dependency was updated',
          '- The `go` directive was updated for compatibility reasons',
          '',
          '',
          'Details:',
          '',
          '',
          '| **Package**          | **Change**           |',
          '| :------------------- | :------------------- |',
          '| `go`                 | `1.22.0` -> `1.22.2` |',
          '| `github.com/bar/bar` | `v2.0.0` -> `v2.2.2` |',
        ].join('\n'),
      );
    });
  });
});
