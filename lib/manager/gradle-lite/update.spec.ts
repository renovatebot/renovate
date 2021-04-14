import { getName } from '../../../test/util';
import { updateDependency } from './update';

describe(getName(__filename), () => {
  it('replaces', () => {
    expect(
      updateDependency({
        fileContent: '___1.2.3___',
        upgrade: {
          currentValue: '1.2.3',
          newValue: '1.2.4',
          managerData: {
            fileReplacePosition: 3,
          },
        },
      })
    ).toEqual('___1.2.4___');
  });

  it('groups', () => {
    expect(
      updateDependency({
        fileContent: '___1.2.4___',
        upgrade: {
          currentValue: '1.2.3',
          newValue: '1.2.5',
          groupName: 'group',
          managerData: {
            fileReplacePosition: 3,
          },
        },
      })
    ).toEqual('___1.2.5___');
  });

  it('returns same content', () => {
    const fileContent = '___1.2.4___';
    expect(
      updateDependency({
        fileContent,
        upgrade: {
          currentValue: '1.2.3',
          newValue: '1.2.4',
          managerData: {
            fileReplacePosition: 3,
          },
        },
      })
    ).toBe(fileContent);
  });

  it('returns null', () => {
    expect(
      updateDependency({
        fileContent: '___1.3.0___',
        upgrade: {
          currentValue: '1.2.3',
          newValue: '1.2.4',
          managerData: {
            fileReplacePosition: 3,
          },
        },
      })
    ).toBeNull();

    expect(
      updateDependency({
        fileContent: '',
        upgrade: {
          currentValue: '1.2.3',
          newValue: '1.2.4',
          managerData: {
            fileReplacePosition: 3,
          },
        },
      })
    ).toBeNull();
  });
});
