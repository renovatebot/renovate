import { JSONWriter } from './json-writer';

describe('util/json-writer/json-writer', () => {
  const DATA = {
    value: 1,
  };

  it('should apply 2 spaces indentation by default', () => {
    const jsonWriter = new JSONWriter();

    expect(jsonWriter.write(DATA)).toBe('{\n  "value": 1\n}\n');
  });

  it('should apply indentation size', () => {
    const jsonWriter = new JSONWriter({
      indentationType: 'space',
      indentationSize: 10,
    });

    expect(jsonWriter.write(DATA)).toBe('{\n          "value": 1\n}\n');
  });

  it('should apply indentation type', () => {
    const jsonWriter = new JSONWriter({
      indentationType: 'tab',
    });

    expect(jsonWriter.write(DATA)).toBe('{\n\t"value": 1\n}\n');
  });

  it('new line at the end should be optional', () => {
    const jsonWriter = new JSONWriter({
      indentationType: 'space',
      indentationSize: 10,
    });

    expect(jsonWriter.write(DATA, false)).toBe('{\n          "value": 1\n}');
  });
});
