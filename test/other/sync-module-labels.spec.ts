import {
  createModuleLabel,
  formatMissingLabels,
  getExpectedModuleLabels,
  getMissingModuleLabels,
} from '../../tools/sync-module-labels.ts';

describe('other/sync-module-labels', () => {
  it('creates module labels with the expected metadata', () => {
    expect(createModuleLabel('manager', 'jsonata')).toEqual({
      color: 'C5DEF5',
      description: 'Related to the jsonata manager',
      name: 'manager:jsonata',
    });
  });

  it('reports missing labels without flagging existing ones', () => {
    const missing = getMissingModuleLabels(
      [
        createModuleLabel('datasource', 'docker'),
        createModuleLabel('manager', 'jsonata'),
        createModuleLabel('platform', 'scm-manager'),
      ],
      [
        createModuleLabel('datasource', 'docker'),
        createModuleLabel('platform', 'scm-manager'),
      ],
    );

    expect(missing).toEqual([createModuleLabel('manager', 'jsonata')]);
    expect(formatMissingLabels(missing)).toContain('manager:jsonata');
  });

  it('includes labels for known runtime module ids', () => {
    const labelNames = new Set(
      getExpectedModuleLabels().map((label) => label.name),
    );

    expect(labelNames.has('datasource:github-digest')).toBe(true);
    expect(labelNames.has('manager:jsonata')).toBe(true);
    expect(labelNames.has('manager:helm-values')).toBe(true);
  });
});
