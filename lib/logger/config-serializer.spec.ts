import { getName } from '../../test/util';
import configSerializer from './config-serializer';

describe(getName(), () => {
  it('squashes templates', () => {
    const config = {
      nottoken: 'b',
      prBody: 'foo',
    };
    // FIXME: explicit assert condition
    expect(configSerializer(config)).toMatchSnapshot();
  });
  it('suppresses content', () => {
    const config = {
      content: {},
    };
    // FIXME: explicit assert condition
    expect(configSerializer(config)).toMatchSnapshot();
  });
});
