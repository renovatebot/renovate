import { SemanticCommitMessage } from './semantic-commit-message';

describe('workers/repository/model/semantic-commit-message', () => {
  it('should format message without prefix', () => {
    const message = new SemanticCommitMessage();
    message.subject = 'test';

    expect(message.toString()).toBe('Test');
  });

  it('should format sematic type', () => {
    const message = new SemanticCommitMessage();
    message.subject = 'test';
    message.type = ' fix ';

    expect(message.toString()).toBe('fix: test');
  });

  it('should format sematic prefix with scope', () => {
    const message = new SemanticCommitMessage();
    message.subject = 'test';
    message.type = ' fix ';
    message.scope = ' scope ';

    expect(message.toString()).toBe('fix(scope): test');
  });

  it('should create instance from string without scope', () => {
    const instance = SemanticCommitMessage.fromString('feat: ticket 123');
    const json = instance.toJSON();

    expect(SemanticCommitMessage.is(instance)).toBeTrue();
    expect(json.type).toBe('feat');
    expect(json.scope).toBe('');
    expect(json.subject).toBe('ticket 123');
  });

  it('should create instance from string with scope', () => {
    const instance = SemanticCommitMessage.fromString(
      'fix(dashboard): ticket 123'
    );
    const json = instance.toJSON();

    expect(SemanticCommitMessage.is(instance)).toBeTrue();
    expect(json.type).toBe('fix');
    expect(json.scope).toBe('dashboard');
    expect(json.subject).toBe('ticket 123');
  });

  it('should create instance from string with empty description', () => {
    const instance = SemanticCommitMessage.fromString('fix(deps): ');
    const json = instance.toJSON();

    expect(SemanticCommitMessage.is(instance)).toBeTrue();
    expect(json.type).toBe('fix');
    expect(json.scope).toBe('deps');
    expect(json.subject).toBe('');
  });
});
