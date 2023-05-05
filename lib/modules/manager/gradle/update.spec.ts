import { updateDependency } from '.';

describe('modules/manager/gradle/update', () => {
  it('replaces', async () => {
    expect(
      await updateDependency({
        fileContent: '###1.2.3###',
        upgrade: {
          currentValue: '1.2.3',
          newValue: '1.2.4',
          managerData: {
            fileReplacePosition: 3,
          },
        },
      })
    ).toBe('###1.2.4###');
  });

  it('groups', async () => {
    expect(
      await updateDependency({
        fileContent: '###1.2.4###',
        upgrade: {
          currentValue: '1.2.3',
          newValue: '1.2.5',
          groupName: 'group',
          managerData: {
            fileReplacePosition: 3,
          },
        },
      })
    ).toBe('###1.2.5###');
  });

  it('returns same content', async () => {
    const fileContent = '###1.2.4###';
    expect(
      await updateDependency({
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

  it('returns null', async () => {
    expect(
      await updateDependency({
        fileContent: '###1.3.0###',
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
      await updateDependency({
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

  it('should return null for replacement', async () => {
    const res = await updateDependency({
      fileContent: '',
      upgrade: { updateType: 'replacement' },
    });
    expect(res).toBeNull();
  });
});
