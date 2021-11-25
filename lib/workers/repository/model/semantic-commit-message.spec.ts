import { SemanticCommitMessage } from './semantic-commit-message';

describe('workers/repository/model/semantic-commit-message', () => {
  it('should create instance from string without scope', () => {
    const instance = SemanticCommitMessage.fromString('feat: ticket 123');

    expect(instance).toBeInstanceOf(SemanticCommitMessage);
    expect(instance.type).toBe('feat');
    expect(instance.scope).toBeUndefined();
    expect(instance.description).toBe('ticket 123');
  });

  it('should create instance from string with scope', () => {
    const instance = SemanticCommitMessage.fromString(
      'fix(dashboard): ticket 123'
    );

    expect(instance).toBeInstanceOf(SemanticCommitMessage);
    expect(instance.type).toBe('fix');
    expect(instance.scope).toBe('dashboard');
    expect(instance.description).toBe('ticket 123');
  });

  it('should create instance from string with empty description', () => {
    const instance = SemanticCommitMessage.fromString('fix(deps): ');

    expect(instance).toBeInstanceOf(SemanticCommitMessage);
    expect(instance.type).toBe('fix');
    expect(instance.scope).toBe('deps');
    expect(instance.description).toBe('');
  });

  it('should create instance from string with empty scope and description', () => {
    const instance = SemanticCommitMessage.fromString('fix:');

    expect(instance).toBeInstanceOf(SemanticCommitMessage);
    expect(instance.type).toBe('fix');
    expect(instance.scope).toBeUndefined();
    expect(instance.description).toBe('');
  });
});
