# Language constraints and upgrading

## Package releases have language constraints

Many ecosystems have the concept where each release of a package has its own language "constraint".
For example, a npm package may support Node.js 18 and 20 in its `v1` releases and Node.js 20 and 22 from `v2.0.0` onwards.

In an ideal scenario:

- Package files allow a project to show its supported language constraints, and
- Package registries allow packages to show the supported language constraints per release

## Restricting upgrades to compatible releases

By default Renovate _does not_ apply language constraints to upgrades.
This means Renovate will propose "any" stable upgrade.
Renovate will _not_ check if the language version you're using actually supports that upgrade.
In certain ecosystems, changes to language constraints are made with a major release, and are documented in the release notes.
So Renovate's default behavior may be okay in those ecosystems.
For other ecosystems Renovate's default behavior may seem _wrong_.

As a Renovate user, you can opt into strict compatibility filtering by setting `constraintsFiltering=strict`.
Before you set `constraintsFiltering=strict`, you should:

- understand the limitations of this setting
- understand why `constraintsFiltering=strict` is _not_ the default behavior

Please keep reading to learn more.

## Language constraint updating

The first challenge is that Renovate may not yet support the ability to update your language constraints in an automated manner, and even when it does, users may not understand how many updates are depending on it.

For example: a Node.js project has set its `engines` field to `"node": "^18.0.0 || ^20.0.0"`.

Should Renovate _skip_ Node.js `v21` because it is a non-LTS release?
When Node.js `v22` releases, should Renovate add it to your `engines`, or wait until `v22` becomes the LTS version?
When Node.js `v18` is EOL, should Renovate drop it from the `engines` field?

Renovate can not guess what users want.
Users have strong and different opinions on what Renovate should do for each example listed above.

Also, even _if_ Renovate guesses right or adds advanced capabilities to allow this to be configurable: users might still wait on any of these "major" upgrades for months.
If a project waits to create or merge the update to drop Node.js `v18` from `engines`, then they can _not_ upgrade to any new versions of library dependencies.
Those library dependencies may have dropped support for Node.js `v18` already.

## Strict filtering limitations

Let's go back to the Node.js project which has its `engines` field set to `"node": "^18.0.0 || ^20.0.0"`.

Now also consider a library which sets its `engines` field to `"node": "^18.12.0 || ^20.9.0"` because the library only supports "LTS releases" of Node.js.
Strictly speaking, this library is _not_ compatible with the project above, because the project has _wider requirements_ for their Node versions.
This means Renovate holds back any upgrades for it.
Should Renovate somehow "think" and _assume_ that this narrower `engines` support is actually OK?
What if the project _already_ used a current version of this library "in a way that's not officially supported"?

A second problem is that if:

- Renovate can _not_ update the language constraints, or
- a user _ignores_ or does not see the language upgrade

Then the user may not know that many dependencies are out of date, because Renovate is not creating PRs.
For example: a project may have 10 dependencies, and 8 of those have updates.
But all 8 dependencies need the project to update its language constraints _first_.
The project administrator thinks they are up to date, because Renovate is not creating PRs, but 80% of their dependencies are outdated.

In short, users who set `constraintsFiltering=strict` often do not understand how _strict_ that setting is and how many releases it will _filter out_.

## Transitive constraint limitations

Often a library sets language constraints (like the `engines` examples above), and then depend on libraries with _narrower_ constraints, like `"node": "^20.0.0"`.
In cases like these, Renovate "trusts" the declaration of the library and may create a update, even _with_ strict constraints filtering.

For some package managers, like `npm`, this incompatibility will _not_ be detected or warned about (even during lock file generation), but this may not be a problem for your application.
Other package managers, like Poetry, may detect and warn about incompatible language constraints during lock file generation, which Renovate reports as an "Artifacts update error".

## Applying constraints through config

You can set language constraints in the Renovate config.
For example:

```json title="Renovate config with Node.js constraints"
{
  "constraints": {
    "node": "^18.0.0 || >=20.0.0"
  }
}
```

You may need to set constraints in the Renovate config when:

- The package manager of the project does not support constraints declarations, or
- The project has not declared any constraints, or
- You want Renovate to use _different_ constraints to what's declared in the _project_

Renovate will _not_ create "update" PRs to update any of these versions once they become outdated, so you must update those by hand.
For this reason, setting constraints manually in the Renovate config is _undesirable_.
We prefer to fix problems in Renovate itself, instead of you setting constraints.

## Future Work

Please start, or join, a GitHub Discussion if you are interested in this topic.
Subtopics include:

- Improving language constraints update automation in package files
- Improving versioning calculations of "subset" (is range A a subset of range B)
