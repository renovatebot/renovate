Handles version numbers inside `ProjectSettings/ProjectVersion.txt` files used by the Unity game engine.

`ProjectSettings/ProjectVersion.txt` always contains two version references in a yml-like syntax; one with and one without a hash, both of which are updated:

```yml
m_EditorVersion: 2020.3.15f2
m_EditorVersionWithRevision: 2020.3.15f2 (6cf78cb77498)
```

Relies on the corresponding `unity3d` datasource and versioning.
