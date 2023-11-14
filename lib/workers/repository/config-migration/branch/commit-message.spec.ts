import { getConfig } from '../../../../config/defaults';
import { ConfigMigrationCommitMessageFactory } from './commit-message';

describe('workers/repository/config-migration/branch/commit-message', () => {
  const config = getConfig();
  const fileName = 'renovate.json';

  it('creates semantic commit message', () => {
    config.semanticCommits = 'enabled';
    const commitMessageFactory = new ConfigMigrationCommitMessageFactory(
      config,
      fileName,
    );
    expect(commitMessageFactory.getCommitMessage()).toBe(
      'chore(config): migrate config renovate.json',
    );
  });

  it('creates semantic pr title', () => {
    config.semanticCommits = 'enabled';
    const commitMessageFactory = new ConfigMigrationCommitMessageFactory(
      config,
      fileName,
    );
    expect(commitMessageFactory.getPrTitle()).toBe(
      'chore(config): migrate renovate config',
    );
  });

  it('creates non-semantic commit message', () => {
    config.semanticCommits = 'disabled';
    const commitMessageFactory = new ConfigMigrationCommitMessageFactory(
      config,
      fileName,
    );
    expect(commitMessageFactory.getCommitMessage()).toBe(
      'Migrate config renovate.json',
    );
  });

  it('creates non-semantic pr title', () => {
    config.semanticCommits = 'disabled';
    const commitMessageFactory = new ConfigMigrationCommitMessageFactory(
      config,
      fileName,
    );
    expect(commitMessageFactory.getPrTitle()).toBe('Migrate renovate config');
  });

  it('returns default values when commitMessage template string is empty', () => {
    config.semanticCommits = 'disabled';
    config.commitMessage = '';
    const commitMessageFactory = new ConfigMigrationCommitMessageFactory(
      config,
      fileName,
    );
    expect(commitMessageFactory.getPrTitle()).toBe('Migrate renovate config');
  });
});
