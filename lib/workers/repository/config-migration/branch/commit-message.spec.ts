import { getConfig } from '../../../../config/defaults';
import * as template from '../../../../util/template';
import { ConfigMigrationCommitMessageFactory } from './commit-message';

describe('workers/repository/config-migration/branch/commit-message', () => {
  const config = getConfig();
  const fileName = 'renovate.json';
  const templateCompileSpy = jest.spyOn(template, 'compile');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  it('creates semantic commit message', () => {
    config.semanticCommits = 'enabled';
    const semanticFactory = new ConfigMigrationCommitMessageFactory(
      config,
      fileName
    );
    expect(semanticFactory.getCommitMessage()).toBe(
      'chore(config): migrate config renovate.json'
    );
    expect(semanticFactory.getCommitMessage()).toBe(
      'chore(config): migrate config renovate.json'
    );
    expect(templateCompileSpy).toHaveBeenCalledTimes(1);
  });

  it('creates semantic pr title', () => {
    config.semanticCommits = 'enabled';
    const semanticFactory = new ConfigMigrationCommitMessageFactory(
      config,
      fileName
    );
    expect(semanticFactory.getPrTitle()).toBe(
      'chore(config): migrate renovate config'
    );
    expect(semanticFactory.getPrTitle()).toBe(
      'chore(config): migrate renovate config'
    );
    expect(templateCompileSpy).toHaveBeenCalledTimes(1);
  });

  it('creates non-semantic commit message', () => {
    config.semanticCommits = 'disabled';
    const semanticFactory = new ConfigMigrationCommitMessageFactory(
      config,
      fileName
    );
    expect(semanticFactory.getCommitMessage()).toBe(
      'Migrate config renovate.json'
    );
    expect(semanticFactory.getCommitMessage()).toBe(
      'Migrate config renovate.json'
    );
    expect(templateCompileSpy).toHaveBeenCalledTimes(1);
  });

  it('creates non-semantic pr title', () => {
    config.semanticCommits = 'disabled';
    const semanticFactory = new ConfigMigrationCommitMessageFactory(
      config,
      fileName
    );
    expect(semanticFactory.getPrTitle()).toBe('Migrate renovate config');
    expect(semanticFactory.getPrTitle()).toBe('Migrate renovate config');
    expect(templateCompileSpy).toHaveBeenCalledTimes(1);
  });

  it('returns default values when commitMessage template string is empty', () => {
    config.semanticCommits = 'disabled';
    config.commitMessage = '';
    const semanticFactory = new ConfigMigrationCommitMessageFactory(
      config,
      fileName
    );
    expect(semanticFactory.getPrTitle()).toBe('Migrate renovate config');
    expect(semanticFactory.getCommitMessage()).toBe(
      'Migrate config renovate.json'
    );
    expect(templateCompileSpy).toHaveBeenCalledTimes(0);
  });
});
