# Language Constraints and Upgrading

## Package Releases have language constraints

Many ecosystems support the concept that each release of packages has its own language "constraint".
For example, a npm package may support Node.js 18 and 20 in its v1 releases and Node.js 20 and 22 from v2.0.0 onwards.

In an ideal scenario:

- Package files allow a project to declare its supported language constraints, and
- Package registries allow packages to declare declare the supported language constraints per release

## Restricting upgrades to compatible releases

By default Renovate _does not_ apply language constraints to upgrades, which means it will propose "any" stable upgrade without consideration of language version.
For certain ecosystems, changes to language constraints are usually done in major releases and documented in the release notes, so this behavior may not be problematic.
For other ecosystems this may seem simply _wrong_.

Renovate users can opt into strict compatibility filtering using `constraintsFiltering=strict`.
You should understand the limitations of this first, also as an understanding of why it's not the default behavior.

## Language constraint updating

The first challenge is that Renovate may not yet support the ability to update your language constraints in an automated manner, and even when it does, users may not understand how many updates are depending on it.

For example, consider a Node.js project which has its `engines` set to `"node": "^18.0.0 || ^20.0.0"`.

Should Renovate skip Node.js v21 because it's non-LTS?
When Node.js v22 comes out, should Renovate add it to your engines, or wait until it starts LTS?
When Node.js v18 is EOL, should Renovate drop it from the engines list?

It's hard for Renovate to know or guess what users want, because users have strong but also different opinions on the answer to the above questions.

Additionally, even if Renovate guesses right or adds advanced capabilities to allow this to be configurable, then users might sit any of these "major" upgrades for months.
If a project delays creating or merging the update to drop Node.js v18 from engines then it won't be able to upgrade to any new versions of library dependencies which themselves already dropped support.

## Strict filtering limitations

Consider again the Node.js project which has its `engines` set to `"node": "^18.0.0 || ^20.0.0"`.

Now also consider a library which sets its `engines` to `"node": "^18.12.0 || ^20.9.0"` because it wants to only support "LTS releases" of Node.js.
Strictly speaking, this dependency is not compatible with the project above which has wider requirements for Node versions, and Renovate would hold back any upgrades for it.
Should Renovate somehow reason and _assume_ that this narrower engines support is actually OK?
What if the project _already_ used an existing version of this library "incorrectly"?

A second problem is that if Renovate is unable to update the language constraints, or the user ignores or does not notice the language upgrade, then they also may not realize that many of their dependencies are out of date because Renovate is not proposing PRs.
For example, a project may have 10 dependencies, and 8 of those have updates but all 8 require the project to update its language constraints first.
The project administrator may think they are mostly up to date, because Renovate is not proposing PRs, but in reality 80% of their dependencies are outdated.

In short, users who apply `constraintsFiltering=strict` usually understimate just how strict that will be and how many releases will be filtered out.

## Transitive constraint limitations

It is a common problem that a library may declare language constraints (such as the `engines` from the above examples) but then itself depend on one or more libraries which have narrower contraints (such as `"node": "^20.0.0"`).
In such scenarios Renovate "trusts" the declaration of the library and may propose it as an update even with strict constraints filtering.

For some package managers, such as npm, this incompatibility won't be detected or warned (even during lock file generation), although it may also not be a problem in your application either.
Other package managers, such as Poetry, may detect incompatible language constraints during lock file generation and Renovate will report that as an "Artifacts update error".

## Applying constraints through config

Renovate supports the manual configuration of language constraints in its config. For example:

```json title="Renovate config with Node.js constraints"
{
  "constraints": {
    "node": "^18.0.0 || >=20.0.0"
  }
}
```

Defining constraints manually using Renovate config can be necessary for the following use cases:

- The package manager of the project doesn't support constraints declarations, or
- The project hassn't declared any constraints, or
- The user wants Renovate to use different constraints to what's declared in the project.

Renovate will not propose "update" PRs proposing to update any of these versions once they become outdated, so the user is responsible for keeping them updated manually.
For this reason, configuring constraints manually in config is considered _undesirable_ and we'd prefer to fix problems in Renovate instead if that's the reason for needing it.

## Future Work

Please start or join a GitHub Discussion if you have an interest in this topic.
Subtopics include:

- Improving language constraints update automation in package files
- Improving versioning calculations of "subset" (is range A a subset of range B)
