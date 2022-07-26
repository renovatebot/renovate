import { getConfig } from '../../../../config/defaults';
import { ConfigMigrationSemanticFactory } from './commit-message';

describe('workers/repository/config-migration/branch/commit-message', () => {
  const config = getConfig();
  const fileName = 'renovate.json';

  it('creates semantic commit message', () => {
    config.semanticCommits = 'enabled';
    const semanticFactory = new ConfigMigrationSemanticFactory(
      config,
      fileName
    );
    expect(semanticFactory.getCommitMessage()).toBe(
      'chore(config): migrate config renovate.json'
    );
  });

  it('creates semantic pr title', () => {
    config.semanticCommits = 'enabled';
    const semanticFactory = new ConfigMigrationSemanticFactory(
      config,
      fileName
    );
    expect(semanticFactory.getPrTitle()).toBe(
      'chore(config): migrate renovate config'
    );
  });

  it('creates non-semantic commit message', () => {
    config.semanticCommits = 'disabled';
    const semanticFactory = new ConfigMigrationSemanticFactory(
      config,
      fileName
    );
    expect(semanticFactory.getCommitMessage()).toBe(
      'Migrate config renovate.json'
    );
  });

  it('creates non-semantic pr title', () => {
    config.semanticCommits = 'disabled';
    const semanticFactory = new ConfigMigrationSemanticFactory(
      config,
      fileName
    );
    expect(semanticFactory.getPrTitle()).toBe('Migrate renovate config');
  });
});
