import configSerializer from './config-serializer';

describe('logger/config-serializer', () => {
  it('squashes templates', () => {
    const config = {
      nottoken: 'b',
      prBody: 'foo',
    };
    expect(configSerializer(config)).toEqual({
      nottoken: 'b',
      prBody: '[Template]',
    });
  });

  it('suppresses content', () => {
    const config = {
      content: {},
    };
    expect(configSerializer(config)).toEqual({
      content: '[content]',
    });
  });

  it('suppresses packageFiles', () => {
    const config = {
      packageFiles: [],
    };
    expect(configSerializer(config)).toEqual({
      packageFiles: '[Array]',
    });
  });
});
