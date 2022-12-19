import { replaceAt } from './string';

describe('util/string', () => {
  describe('replaceAt', () => {
    test('replaceAt inserts newString which is one char longer than oldString', () => {
      const content = 'I am a dog';
      const index = 2;
      const newString = 'are';
      const oldString = 'am';

      const newContent = replaceAt(content, index, oldString, newString);

      expect(newContent).toBe('I are a dog');
    });

    test('replaceAt inserts newString which is significantly longer than oldString', () => {
      const content = 'I am a dog';
      const index = 2;
      const newString = 'want to have a new pet maybe';
      const oldString = 'am';

      const newContent = replaceAt(content, index, oldString, newString);

      expect(newContent).toBe('I want to have a new pet maybe a dog');
    });
  });
});
