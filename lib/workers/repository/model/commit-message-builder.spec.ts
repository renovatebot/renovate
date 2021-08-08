import { getName } from '../../../../test/util';
import { CommitMessage } from './commit-message';
import { CommitMessageBuilder } from './commit-message-builder';

describe(getName(), () => {
  describe('CommitMessageBuilder', () => {
    let builder = new CommitMessageBuilder();

    beforeEach(() => {
      builder = new CommitMessageBuilder();
    });

    it('should build message without prefix', () => {
      builder.setMessage('test');
      expect(builder.build()).toEqual(new CommitMessage('test'));
    });

    it('should build message with custom prefix', () => {
      builder.setMessage('test');
      builder.withCustomPrefix('prefix');
      expect(builder.build()).toEqual(new CommitMessage('test', 'prefix'));
    });

    it('should build message with semantic prefix', () => {
      builder.setMessage('test');
      builder.withSemanticPrefix('type', 'scope');
      expect(builder.build()).toEqual(new CommitMessage('test', 'type(scope)'));
    });
  });
});
