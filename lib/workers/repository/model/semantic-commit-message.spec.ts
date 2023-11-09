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

  it('should transform to lowercase only first letter', () => {
    const message = new SemanticCommitMessage();
    message.subject = 'Update My Org dependencies';
    message.type = 'fix';
    message.scope = 'deps ';

    expect(message.toString()).toBe('fix(deps): update My Org dependencies');
  });

  it('should create instance from string without scope', () => {
    const instance = SemanticCommitMessage.fromString('feat: ticket 123');

    expect(SemanticCommitMessage.is(instance)).toBeTrue();
    expect(instance?.toJSON()).toEqual({
      body: '',
      footer: '',
      scope: '',
      subject: 'ticket 123',
      type: 'feat',
    });
  });

  it('should create instance from string with scope', () => {
    const instance = SemanticCommitMessage.fromString(
      'fix(dashboard): ticket 123',
    );

    expect(SemanticCommitMessage.is(instance)).toBeTrue();
    expect(instance?.toJSON()).toEqual({
      body: '',
      footer: '',
      scope: 'dashboard',
      subject: 'ticket 123',
      type: 'fix',
    });
  });

  it('should create instance from string with empty description', () => {
    const instance = SemanticCommitMessage.fromString('fix(deps): ');

    expect(SemanticCommitMessage.is(instance)).toBeTrue();
    expect(instance?.toJSON()).toEqual({
      body: '',
      footer: '',
      scope: 'deps',
      subject: '',
      type: 'fix',
    });
  });

  it('should return undefined for invalid string', () => {
    const instance = SemanticCommitMessage.fromString('test');
    expect(instance).toBeUndefined();
  });
});
