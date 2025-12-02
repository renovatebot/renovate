Manages version numbers in the `ProjectVersion.txt` file located within the `ProjectSettings` folder of a Unity project.

Example path: `/home/user/testUnityProject/ProjectSettings/ProjectVersion.txt`.

`ProjectVersion.txt` always have two version references in YAML syntax; one with revision and another one without it.
Both are updated together.

```yml
m_EditorVersion: 2020.3.15f2
m_EditorVersionWithRevision: 2020.3.15f2 (6cf78cb77498)
```
