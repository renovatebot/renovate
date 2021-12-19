import { SemanticCommitMessage } from './semantic-commit-message';

describe('workers/repository/model/semantic-commit-message', () => {
  it('should format sematic type', () => {
    const message = new SemanticCommitMessage();
    message.setSubject('test');
    message.setType(' fix ');

    expect(message.toString()).toBe('fix: test');
  });

  it('should format sematic prefix with scope', () => {
    const message = new SemanticCommitMessage();
    message.setSubject('test');
    message.setType(' fix ');
    message.setScope(' scope ');

    expect(message.toString()).toBe('fix(scope): test');
  });

  it('should create instance from string without scope', () => {
    const instance = SemanticCommitMessage.fromString('feat: ticket 123');
    const json = instance.toJSON();

    expect(instance).toBeInstanceOf(SemanticCommitMessage);
    expect(json.type).toBe('feat');
    expect(json.scope).toBeUndefined();
    expect(json.subject).toBe('ticket 123');
  });

  it('should create instance from string with scope', () => {
    const instance = SemanticCommitMessage.fromString(
      'fix(dashboard): ticket 123'
    );
    const json = instance.toJSON();

    expect(instance).toBeInstanceOf(SemanticCommitMessage);
    expect(json.type).toBe('fix');
    expect(json.scope).toBe('dashboard');
    expect(json.subject).toBe('ticket 123');
  });

  it('should create instance from string with empty description', () => {
    const instance = SemanticCommitMessage.fromString('fix(deps): ');
    const json = instance.toJSON();

    expect(instance).toBeInstanceOf(SemanticCommitMessage);
    expect(json.type).toBe('fix');
    expect(json.scope).toBe('deps');
    expect(json.subject).toBe('');
  });

  it('should create instance from string with empty scope and description', () => {
    const instance = SemanticCommitMessage.fromString('fix:');
    const json = instance.toJSON();

    expect(instance).toBeInstanceOf(SemanticCommitMessage);
    expect(json.type).toBe('fix');
    expect(json.scope).toBeUndefined();
    expect(json.subject).toBe('');
  });
});
