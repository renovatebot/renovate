import { codeBlock } from 'common-tags';
import type { UpdateLockedConfig } from '../types.ts';
import {
  rebindUpdatedToolSelectors,
  updateLockedDependency,
} from './update-locked.ts';

describe('modules/manager/mise/update-locked', () => {
  describe('rebindUpdatedToolSelectors', () => {
    const content = codeBlock`
      [[tools.hk]]
      version = "2.6.0"
      specifiers = ["2.6.0"]
      [tools.hk.platforms.linux-x64]
      url = "https://github.com/jdx/hk/releases/download/v2.6.0/hk.tar.gz"
      checksum = "keep-checksum"

      [[tools.node]]
      version = "24.16.0"
      specifiers = ["24.16.0"]
    `;
    const update = { depName: 'hk', newVersion: '2.6.0', newValue: 'latest' };

    it('restores a selector without changing metadata or unrelated entries', () => {
      expect(rebindUpdatedToolSelectors(content, [update])).toBe(
        content.replace('["2.6.0"]', '["latest"]'),
      );
    });

    it('applies multiple edits in reverse source order', () => {
      expect(
        rebindUpdatedToolSelectors(content, [
          update,
          { depName: 'core:node', newVersion: '24.16.0', newValue: '24' },
        ]),
      ).toBe(
        content
          .replace('["2.6.0"]', '["latest"]')
          .replace('["24.16.0"]', '["24"]'),
      );
    });

    it('combines selectors for the same regenerated entry', () => {
      expect(
        rebindUpdatedToolSelectors(content, [
          update,
          { ...update, newValue: '2' },
        ]),
      ).toBe(content.replace('["2.6.0"]', '["latest","2"]'));
    });

    it('uses the current selector when the update has no new value', () => {
      expect(
        rebindUpdatedToolSelectors(content, [
          { ...update, newValue: undefined, currentValue: 'latest' },
        ]),
      ).toBe(content.replace('["2.6.0"]', '["latest"]'));
    });

    it('removes old version and replaced-selector bindings from the new entry', () => {
      const stale = content.replace('["2.6.0"]', '["2.5.0","2.6.0","2","lts"]');
      expect(
        rebindUpdatedToolSelectors(stale, [
          { ...update, currentVersion: '2.5.0', currentValue: '2' },
        ]),
      ).toBe(stale.replace('["2.5.0","2.6.0","2","lts"]', '["lts","latest"]'));
    });

    it('preserves an already matching binding and unrelated selectors', () => {
      const bound = content.replace('["2.6.0"]', '["lts","latest"]');
      expect(rebindUpdatedToolSelectors(bound, [update])).toBe(bound);
    });

    it('handles quoted binding keys and canonical versions', () => {
      const quoted = content
        .replace('version = "2.6.0"', 'version = "v2.6.0"')
        .replace('specifiers = ["2.6.0"]', '"specifiers" = ["2.6.0"]');
      expect(rebindUpdatedToolSelectors(quoted, [update])).toBe(
        quoted.replace('["2.6.0"]', '["latest"]'),
      );
    });

    it('preserves old lock files without request bindings', () => {
      const legacy = '[[tools.hk]]\nversion = "2.6.0"\n';
      expect(rebindUpdatedToolSelectors(legacy, [update])).toBe(legacy);
    });

    it('keeps a legacy sibling while rebinding the selected entry', () => {
      const mixed = `${content}\n[[tools.hk]]\nversion = "2.5.0"\n`;
      expect(rebindUpdatedToolSelectors(mixed, [update])).toBe(
        mixed.replace('["2.6.0"]', '["latest"]'),
      );
    });

    it.each([
      {},
      { depName: '', newVersion: '2.6.0' },
      { depName: 'hk', newVersion: '' },
    ])('ignores an update without an exact selected target: %j', (invalid) => {
      expect(rebindUpdatedToolSelectors(content, [invalid])).toBe(content);
    });

    it.each([
      { ...update, depName: 'missing' },
      { ...update, newVersion: '2.7.0' },
      { ...update, newValue: undefined },
    ])(
      'rejects a missing entry or unknown configured selector: %j',
      (invalid) => {
        expect(() => rebindUpdatedToolSelectors(content, [invalid])).toThrow(
          /mise/,
        );
      },
    );

    it('rejects multiple matching entries', () => {
      const duplicate = `${content}\n[[tools.hk]]\nversion = "2.6.0"\nspecifiers = ["preview"]\n`;
      expect(() => rebindUpdatedToolSelectors(duplicate, [update])).toThrow(
        'Ambiguous',
      );
    });

    it('rejects a selector already bound to a different entry', () => {
      const conflict = `${content}\n[[tools.hk]]\nversion = "2.5.0"\nspecifiers = ["latest"]\n`;
      expect(() => rebindUpdatedToolSelectors(conflict, [update])).toThrow(
        'Conflicting',
      );
    });

    it('rejects an unbound target in a mixed-format tool', () => {
      const mixed = codeBlock`
        [[tools.hk]]
        version = "2.6.0"
        [[tools.hk]]
        version = "2.5.0"
        specifiers = ["old"]
      `;
      expect(() => rebindUpdatedToolSelectors(mixed, [update])).toThrow(
        'Unsupported',
      );
    });

    it('rejects unsupported inline bindings', () => {
      const inline = '[tools]\nhk = [{version="2.6.0",specifiers=["2.6.0"]}]\n';
      expect(() => rebindUpdatedToolSelectors(inline, [update])).toThrow(
        'Unsupported',
      );
    });
  });

  it('updates only the lockfile version for a major selector', () => {
    const packageFileContent = codeBlock`
      [tools]
      golangci-lint = "2"
    `;
    const lockFileContent = codeBlock`
      [[tools.golangci-lint]]
      version = "2.12.0"
    `;
    const config: UpdateLockedConfig = {
      packageFile: 'mise.toml',
      packageFileContent,
      lockFile: 'mise.lock',
      lockFileContent,
      depName: 'golangci-lint',
      currentVersion: '2.12.0',
      newVersion: '2.13.1',
    };

    expect(updateLockedDependency(config)).toEqual({
      status: 'updated',
      files: {
        'mise.toml': packageFileContent,
        'mise.lock': lockFileContent.replace('2.12.0', '2.13.1'),
      },
    });
  });

  it('removes a datasource prefix when the locked version is bare', () => {
    const lockFileContent = codeBlock`
      [[tools.node]]
      version = "20.11.0"
    `;
    const config: UpdateLockedConfig = {
      packageFile: 'mise.toml',
      packageFileContent: '[tools]\nnode = "20"\n',
      lockFile: 'mise.lock',
      lockFileContent,
      depName: 'node',
      currentVersion: '20.11.0',
      newVersion: 'v20.12.0',
    };

    expect(updateLockedDependency(config)).toMatchObject({
      status: 'updated',
      files: {
        'mise.lock': lockFileContent.replace('20.11.0', '20.12.0'),
      },
    });
  });

  it('updates the matching entry for a multi-version tool', () => {
    const lockFileContent = codeBlock`
      [[tools.python]]
      version = "3.10.17"

      [[tools.python]]
      version = "3.11.12"
    `;
    const config: UpdateLockedConfig = {
      packageFile: 'mise.toml',
      lockFile: 'mise.lock',
      lockFileContent,
      depName: 'python',
      currentVersion: '3.11.12',
      newVersion: '3.11.13',
    };

    expect(updateLockedDependency(config)).toEqual({
      status: 'updated',
      files: {
        'mise.lock': lockFileContent.replace('3.11.12', '3.11.13'),
      },
    });
  });

  it('recognizes an already-updated multi-version tool entry', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'mise.toml',
      lockFile: 'mise.lock',
      lockFileContent: codeBlock`
        [[tools.python]]
        version = "3.10.17"

        [[tools.python]]
        version = "3.11.13"
      `,
      depName: 'python',
      currentVersion: '3.11.12',
      newVersion: '3.11.13',
    };

    expect(updateLockedDependency(config)).toEqual({
      status: 'already-updated',
    });
  });

  it('does not update a different entry for a multi-version tool', () => {
    const config: UpdateLockedConfig = {
      packageFile: 'mise.toml',
      lockFile: 'mise.lock',
      lockFileContent: codeBlock`
        [[tools.python]]
        version = "3.10.17"

        [[tools.python]]
        version = "3.11.12"
      `,
      depName: 'python',
      currentVersion: '3.12.0',
      newVersion: '3.12.1',
    };

    expect(updateLockedDependency(config)).toEqual({ status: 'unsupported' });
  });

  it('treats a nonnumeric current version as an empty prefix', () => {
    const lockFileContent = codeBlock`
      [[tools.node]]
      version = "latest"
    `;
    const config: UpdateLockedConfig = {
      packageFile: 'mise.toml',
      lockFile: 'mise.lock',
      lockFileContent,
      depName: 'node',
      currentVersion: 'latest',
      newVersion: 'v20.12.0',
    };

    expect(updateLockedDependency(config)).toMatchObject({
      status: 'updated',
      files: {
        'mise.lock': lockFileContent.replace('latest', '20.12.0'),
      },
    });
  });

  it('preserves a nonnumeric replacement version', () => {
    const lockFileContent = codeBlock`
      [[tools.example]]
      version = "20.0.0"
    `;
    const config: UpdateLockedConfig = {
      packageFile: 'mise.toml',
      lockFile: 'mise.lock',
      lockFileContent,
      depName: 'example',
      currentVersion: '20.0.0',
      newVersion: 'nightly',
    };

    expect(updateLockedDependency(config)).toMatchObject({
      status: 'updated',
      files: {
        'mise.lock': lockFileContent.replace('20.0.0', 'nightly'),
      },
    });
  });
});
