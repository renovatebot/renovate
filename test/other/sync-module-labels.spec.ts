import { quote } from 'shlex';
import {
  createModuleLabel,
  formatCreateLabelCommands,
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

  it('renders stable label creation commands for missing labels', () => {
    const commands = formatCreateLabelCommands('renovatebot/renovate', [
      {
        color: 'C5DEF5',
        description: "Bob's manager label",
        name: 'manager:jsonata',
      },
      createModuleLabel('datasource', 'docker'),
    ]);

    expect(commands).toBe(
      [
        `gh label create ${quote('datasource:docker')} -R ${quote(
          'renovatebot/renovate',
        )} --color ${quote('C5DEF5')} --description ${quote(
          'Related to the docker datasource',
        )}`,
        `gh label create ${quote('manager:jsonata')} -R ${quote(
          'renovatebot/renovate',
        )} --color ${quote('C5DEF5')} --description ${quote(
          "Bob's manager label",
        )}`,
      ].join('\n'),
    );
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
