# Bucket definitions

Buckets are used to label _kind_ of work an Issue, Discussion or PR represents, independent of area (`manager:`/`platform:`/`core:`) and priority.

These provide a different view of the "backlogs" that the Renovate project has, and to help with prioritising incoming work.

These docs provide a more in-depth view of what the `bucket:*` labels are and how to label an Issue, Discussion or PR.

The below definitions are structured like so:

- `Test`: a one-sentence way of determining whether an Issue/PR/Discussion is part of the bucket
- (additional context): more words that may provide additional context
- `Belongs here`: some historic examples of things that fit within this bucket
- `Not this bucket`: things that do not fit within this bucket, why, and where they would better fit

A short description lives on the label (within GitHub's 100-character limit for a description), and the full text lives here.

Use this page as-is as the classification prompt for an AI labelling pass, or as the reference when triaging by hand.
This should be used alongside the [issue labeling guide](./issue-labeling.md).

Multiple buckets could apply, but are more likely to be a single bucket than many.

One example of a multi-bucket request is [#43428](https://github.com/renovatebot/renovate/discussions/43428) "Pass `POETRY_SOLVER_MIN_RELEASE_AGE` when `minimumReleaseAge` is configured" is `bucket:security-supply-chain` _and_ `bucket:ecosystem-depth` - a security feature delivered through manager integration.

## Suggestions when using LLMs/AI to auto-bucket

Around 2026-10-21, @JamieTanna spent some time investigating how to auto-bucket the existing backlog, with these definitions.
Research indicates (unsurprisingly?) that using a model like Claude Opus is better than Claude Sonnet - albeit Opus still had ~72% "low confidence" scores - and it might not be worth spending as much as Claude Fable needs.
Worth bearing in mind.

## `bucket:ecosystem-depth`

**Test:** does this extend a Manager, Datasource or Versioning scheme that Renovate _already supports_, to cover something its ecosystem added or we never covered?

This is generally the case where the wider ecosystem has moved, and Renovate needs to add support.

A Datasource that happens to be Platform-hosted (for instance Forgejo container timestamps, [#45636](https://github.com/renovatebot/renovate/discussions/45636)) is `ecosystem-depth`.
It would be `platform` if there was new functionality in how Gitea manages their Pull Requests.

For example, if the ask is to make an existing security control work for another ecosystem (e.g. `minimumReleaseAge` for ECR Public, [#44179](https://github.com/renovatebot/renovate/discussions/44179) or npm `allowScripts`, [#44605](https://github.com/renovatebot/renovate/discussions/44605)), also apply `security-supply-chain`.

A new Datasource or Versioning scheme for an ecosystem Renovate already extracts from (e.g. `rust-version`, `graalvm-version` or `github-branches`) is `ecosystem-depth`, not `new-ecosystem`.

Changing a Manager's default behavior to better match how its ecosystem works (e.g. [#42331](https://github.com/renovatebot/renovate/issues/42331) default versioning for `github-actions`, [#44010](https://github.com/renovatebot/renovate/issues/44010) default `rangeStrategy` for NuGet) is `ecosystem-depth`, and also carries `breaking` if users will see different PRs.

Belongs here:

- [#36886](https://github.com/renovatebot/renovate/discussions/36886) - Support bun catalogs
- [#35704](https://github.com/renovatebot/renovate/discussions/35704) - Support PEP 751 lockfiles (`pylock.toml`)
- [#39517](https://github.com/renovatebot/renovate/discussions/39517) - Support `mise`'s `github` backend
- [#44360](https://github.com/renovatebot/renovate/discussions/44360) - Bring NuGet lock file support to parity with npm
- [#36928](https://github.com/renovatebot/renovate/discussions/36928) - Support yarn catalog plugin

Not this bucket:

- [#45740](https://github.com/renovatebot/renovate/discussions/45740) "New package manager: Pkl" → `new-ecosystem` (nothing exists for Pkl yet)
- [#44451](https://github.com/renovatebot/renovate/issues/44451) "Maven pom.xml tags corrupted during multi-dep updates" → `bug-fix` (supported behavior producing wrong output, not a capability gap)

## `bucket:new-ecosystem`

**Test:** this is a net-new Manager, Datasource or Versioning scheme for an ecosystem that Renovate currently extracts nothing from.

An ecosystem is a tool or file format, not a language: a Manager for a new tool (e.g. prek, or tox) is `new-ecosystem` even when Renovate already supports other tools for that language.

Belongs here:

- [#41893](https://github.com/renovatebot/renovate/discussions/41893) - Support LibMan package manager (the canonical item; also asked as [#45069](https://github.com/renovatebot/renovate/discussions/45069) and [#46445](https://github.com/renovatebot/renovate/discussions/46445), both closed as duplicates, i.e. three independent asks)
- [#40967](https://github.com/renovatebot/renovate/discussions/40967) - New package manager: prek
- [#39739](https://github.com/renovatebot/renovate/discussions/39739) - Support Cue language modules
- [#42529](https://github.com/renovatebot/renovate/discussions/42529) - Support dbt packages

Not this bucket:

- [#39517](https://github.com/renovatebot/renovate/discussions/39517) "mise `github` backend" → `ecosystem-depth` (mise exists; this deepens it)
- A `rust-version` Datasource or an Elm Versioning scheme → `ecosystem-depth` (a new module, but Renovate already supports the ecosystem)
- [#42339](https://github.com/renovatebot/renovate/discussions/42339) "Add support for Tangled" / [#38564](https://github.com/renovatebot/renovate/discussions/38564) "Mercurial for Heptapod" → `platform` (new platforms and VCS hosts live with platform work)

## `bucket:ecosystem-data`

**Test:** does this add or correct an _entry_ in Renovate's curated knowledge of the package world - monorepo groupings, replacement/workaround presets, package-list presets (linters etc), `lib/data` files?
The output is not a new behaviour in Renovate, but this data (which may lead to behaviour changes).

Belongs here:

- [#45631](https://github.com/renovatebot/renovate/pull/45631) - `feat(preset): group vite+`
- [#45801](https://github.com/renovatebot/renovate/pull/45801) - `feat(presets/workarounds): group commander major update packages`
- "feat(replacements): kaniko to community fork" (also carries the `lifecycle` flag)
- "feat(presets): add `@oxlint/*` to `packages:linters`"
- Idea [#43472](https://github.com/renovatebot/renovate/discussions/43472) - "Add vuejs/language-tools to monorepo presets"

Not this bucket:

- [#37952](https://github.com/renovatebot/renovate/discussions/37952) "set `minimumReleaseAge` in `config:best-practices`" → `security-supply-chain` (changes policy semantics, not an entry)
- "Group package updates detected within a time window" → `workflow-fit` (a new grouping _capability_, not a grouping entry)
- "feat(mise): support monorepo root lock files" → `ecosystem-depth` (says "monorepo" but changes manager logic)

## `bucket:platform`

**Test:** does delivering this require a platform's API (GitHub, GitLab, Azure DevOps, Bitbucket, Gerrit, Forgejo, Gitea, etc) - feature parity, platform-specific behavior, a new platform, or a migration forced by a platform deprecation?

Git-layer work (clone and fetch behavior, Large File Storage (LFS), commit signing, push and branch handling) also lives here: it's where VCS hosts live, and there is too little of it for a bucket of its own.

Belongs here:

- [#39047](https://github.com/renovatebot/renovate/discussions/39047) / [#39048](https://github.com/renovatebot/renovate/discussions/39048) / [#39049](https://github.com/renovatebot/renovate/discussions/39049) - Gerrit parity: `draftPr`, target-branch updates, stale-branch pruning
- [#44874](https://github.com/renovatebot/renovate/discussions/44874) - Dependency dashboard approval on Azure DevOps
- [#43874](https://github.com/renovatebot/renovate/discussions/43874) - GitLab fine-grained access token scopes instead of full `api` (duplicated by [#45421](https://github.com/renovatebot/renovate/issues/45421); also `security-supply-chain`, as least privilege reduces credential exposure)
- [#36499](https://github.com/renovatebot/renovate/discussions/36499) - Bitbucket app passwords deprecated, so support API tokens instead (forced migration)
- [#36625](https://github.com/renovatebot/renovate/discussions/36625) - GitLab: prevent merge before a specific date (needs platform API capability)

Not this bucket:

- [#38789](https://github.com/renovatebot/renovate/issues/38789) "Renovate incorrectly reads GitLab CODEOWNERS" → `bug-fix` (names a platform, but it's broken supported behavior)
- A bug in platform code (e.g. a `fix(platform/azure)` PR) is `bug-fix` only; add `platform` only when the fix needs a platform-API capability Renovate doesn't use yet. The `platform:*` area labels already give a per-platform view
- [#35956](https://github.com/renovatebot/renovate/discussions/35956) "Option to mark PRs as draft" → `workflow-fit` (config plumbing over a capability every platform already has)
- [#44758](https://github.com/renovatebot/renovate/discussions/44758) "Add a pause before creating MR on GitLab to work around a GitLab bug" → a request for a workaround option is `workflow-fit`; the underlying defect itself ([#44498](https://github.com/renovatebot/renovate/issues/44498)) is `bug-fix`. Ask whether the item reports the defect or asks for a knob
- [#12413](https://github.com/renovatebot/renovate/discussions/12413) "Bitbucket Server: onboarding option to work around a platform limitation" → `platform`. A knob that works around platform _slowness or flakiness_ is `workflow-fit` (as [#44758](https://github.com/renovatebot/renovate/discussions/44758)); a knob that works around a platform _limitation_ needs platform thinking, so it stays here

## `bucket:security-supply-chain`

**Test:** is the user trying to prevent a supply-chain attack, a bad release, or credential/execution exposure?

This covers both protection features for users, and general hardening of Renovate itself.

"Hardening" here means closing a security exposure: a robustness fix for a race or flaky platform (e.g. [#45368](https://github.com/renovatebot/renovate/discussions/45368) "Harden automerge on slower self-hosted GitLab") is `bug-fix` or `platform`.

Classify by the threat we are preventing, even when the mechanism is "just a config option".

Leaking internal package names to outside readers (e.g. [#41636](https://github.com/renovatebot/renovate/discussions/41636), markdown badges) counts as (privacy) exposure, so it belongs here.

The same goes for private-registry data leaking through the shared package cache - e.g. the "`datasource/*`: set `cacheable` explicitly" series ([#46014](https://github.com/renovatebot/renovate/issues/46014), following [#45949](https://github.com/renovatebot/renovate/pull/45949)) is `security-supply-chain`, not `performance-scale`, as the risk is data crossing repositories or tenants, not cache cost.

Belongs here:

- [#38115](https://github.com/renovatebot/renovate/discussions/38115) - `minimumReleaseAge` with lockFileMaintenance and transitive deps (also `bug-fix`, as the title reports it "not working")
- [#42069](https://github.com/renovatebot/renovate/discussions/42069) - Experimental preset for compromised/malicious packages
- [#37253](https://github.com/renovatebot/renovate/discussions/37253) - Warn when an npm package loses attestation/provenance
- [#43823](https://github.com/renovatebot/renovate/discussions/43823) - Run `allowedUnsafeExecutions` without exposing a write token (the hardening half)

Not this bucket:

- [#39581](https://github.com/renovatebot/renovate/discussions/39581) "requireTestsForAutomerge to prevent race-condition automerges" → `workflow-fit` (an automerge condition guarding CI correctness, not a supply-chain threat)
- [#40985](https://github.com/renovatebot/renovate/issues/40985) "`repoInfoQuery` requires unnecessary `issues: read` permission for GitHub Apps" → `platform` _and_ `security-supply-chain` (least privilege, same reasoning as [#43874](https://github.com/renovatebot/renovate/discussions/43874))
- [#36453](https://github.com/renovatebot/renovate/discussions/36453) "Treat GitLab config issues as errors, not warnings" → `predictability`

## `bucket:workflow-fit`

**Test:** "Renovate should raise updates the way _my org_ works" - grouping, scheduling, limits, automerge conditions, PR/commit presentation, reviewers, dashboard shape.

For a repository that means grouping, scheduling, limits, automerge conditions, presentation, reviewers and dashboard shape.
For an instance it means how the Renovate deployment reaches things: credentials and host rules, tool installation (`binarySource`, install mirrors), cache backends, autodiscovery filters and fleet-level limits.
The audience label tells the two apart: `workflow-fit` with `audience:operator` is for a self-hosted administrator (or operator who supports the deployment) view.

The mechanism is almost always a config option - the motivation is because "Renovate is flexible, so you don't have to be", and aims to work within the way the user wants to work.

This shouldn't include anything security-specific - that's `security-supply-chain`.
A request that only exists because a credential or host rule is _silently ignored or misparsed_ is `predictability`.

Belongs here:

- [#44474](https://github.com/renovatebot/renovate/discussions/44474) - Scoped `prConcurrentLimit` per packageRule
- [#38293](https://github.com/renovatebot/renovate/discussions/38293) - Add a schedule for rebase
- [#36072](https://github.com/renovatebot/renovate/discussions/36072) - Split updates into multiple PRs
- [#35956](https://github.com/renovatebot/renovate/discussions/35956) - Option to mark created PRs as draft
- [#45092](https://github.com/renovatebot/renovate/discussions/45092) - `commitMessageSuffix` without an auto-inserted space

Not this bucket:

- [#41472](https://github.com/renovatebot/renovate/discussions/41472) "Prevent PR creation while pending `minimumReleaseAge`" → `security-supply-chain` (the ask exists because of the safety feature)
- [#36625](https://github.com/renovatebot/renovate/discussions/36625) "GitLab: prevent merge before a specific date" → `platform` (needs platform-API capability, not just config plumbing)

## `bucket:predictability`

**Test:** would this make Renovate do the expected thing, or fail loudly instead of silently - validation catching more earlier, config discovery, config migration, clearer warnings or log levels?

A "bug report" for an issue where Renovate doesn't give the user any feedback is here, not a `bug-fix`.

Belongs here:

- [#43741](https://github.com/renovatebot/renovate/discussions/43741) - Regexes not wrapped in `/…/` fail silently
- [#36695](https://github.com/renovatebot/renovate/discussions/36695) - Trailing comma (invalid JSON) doesn't error, times out after 30 minutes
- [#38570](https://github.com/renovatebot/renovate/discussions/38570) - `renovate-config-validator` flag to auto-migrate a config
- [#42501](https://github.com/renovatebot/renovate/issues/42501) - Validator doesn't detect an invalid preset value
- [#41663](https://github.com/renovatebot/renovate/issues/41663) - Config warning when overriding manager `registryUrl`s
- [#38060](https://github.com/renovatebot/renovate/discussions/38060) / [#42367](https://github.com/renovatebot/renovate/discussions/42367) - Config _discovery_: which file names and directories Renovate looks in (`.jsonc`, `.config/`, `.<platform>/`). Anything silently not picked up is here, and usually also `rough-edge`
- [#12272](https://github.com/renovatebot/renovate/issues/12272) - `renovate-config-validator` ignores configured credentials for private presets (one of Renovate's own tools not doing the expected thing)

Not this bucket:

- Correcting the JSON schema or generated option reference → `docs` (generated reference material is documentation, even though the fix is in code)
- [#42197](https://github.com/renovatebot/renovate/discussions/42197) "The docs for `ignoreDeps` are slightly misleading" → `docs` (the fix is prose, not code)
- [#44448](https://github.com/renovatebot/renovate/issues/44448) "Date-like versions blocked by `maxMajorIncrement` default" → `bug-fix` (wrong behavior, loudly visible)

## `bucket:observability`

**Test:** does this help someone see what Renovate did or why - logs, OpenTelemetry, the Renovate Report, dry-run output, notifications?

Belongs here:

- [#42514](https://github.com/renovatebot/renovate/issues/42514) / [#42515](https://github.com/renovatebot/renovate/issues/42515) - In-depth instrumentation for managers and datasources
- [#44342](https://github.com/renovatebot/renovate/discussions/44342) - Expose `branchFileChanges` in the Renovate Report
- [#37762](https://github.com/renovatebot/renovate/discussions/37762) - Add `currentVersion`/`newVersion` to specific logs

Not this bucket:

- [#42470](https://github.com/renovatebot/renovate/issues/42470) "OTel instrumentation incomplete since 43.93.0" → `bug-fix` (regression in existing instrumentation)
- [#38924](https://github.com/renovatebot/renovate/discussions/38924) "'Repository has invalid config' should be logged as warning" → `predictability` (the point is user-facing expectation, not a new lens)
- [#22143](https://github.com/renovatebot/renovate/discussions/22143) "Dependency dashboard: add links to their changelogs" → `workflow-fit` (how _this user_ wants their dashboard laid out). Compare [#44381](https://github.com/renovatebot/renovate/discussions/44381) "Show ReleaseAge / Timestamp on Dependency Dashboard" → `observability` (new data every dashboard would surface)

### Telling `workflow-fit`, `predictability` and `observability` apart

When all three seem to fit, pick by what the user is asking for:

- they want Renovate to _behave differently_ (group, schedule, limit, present, automerge, or an option to switch something off) → `workflow-fit`
- they want Renovate to _tell them something it currently hides or gets wrong_ - a missing or misleading warning, a silent ignore, a surprising default, a log line at the wrong level → `predictability`
- they want a _new lens on what already happened_ - log fields, traces, report fields, dashboard or PR-body detail that explains a decision → `observability`

Changing the wording or level of an existing warning, PR-body note or dashboard message is `predictability`.
Adding explanatory content to them (why an update is waiting, which transitive dependencies changed, the automerge schedule) is `observability`.
"Dashboard shape" in `workflow-fit` means which sections and checkboxes exist, not what they say.
A request for an option to silence a warning is a workaround knob, so `workflow-fit` (same reasoning as [#44758](https://github.com/renovatebot/renovate/discussions/44758)); the report that the warning is wrong is `predictability`.

## `bucket:performance-scale`

**Test:** same behavior, less time/memory/API traffic, or working at a scale (repos, orgs, tags, pages) where it currently degrades.
Caching strategy, cloning strategy, pagination, concurrency.

Belongs here:

- [#40426](https://github.com/renovatebot/renovate/issues/40426) - Initial PR-cache seeding on huge repos can run forever
- [#43962](https://github.com/renovatebot/renovate/discussions/43962) - Terraform lock-file hashing concurrency (OOMs on large providers)
- [#38615](https://github.com/renovatebot/renovate/discussions/38615) - Autodiscover sharding for large numbers of repos
- [#39012](https://github.com/renovatebot/renovate/discussions/39012) / [#39009](https://github.com/renovatebot/renovate/discussions/39009) - Avoid fetching tags / only fetch necessary branches
- [#39831](https://github.com/renovatebot/renovate/discussions/39831) - Efficiency for large Azure DevOps organisations

Not this bucket:

- [#46238](https://github.com/renovatebot/renovate/issues/46238) "Docker Hub digest lookup returns stale cached digest" → `bug-fix` (cache _correctness_, not cache cost)

## `bucket:bug-fix`

**Test:** supported behavior producing visibly wrong output - crashes, corruption, wrong versions, failed commands.

This is separate to the `regression` label, which can also be applied when we have found the root cause of a regression.

Belongs here:

- [#46238](https://github.com/renovatebot/renovate/issues/46238) - Stale cached digest for mutable Docker tags
- [#40294](https://github.com/renovatebot/renovate/issues/40294) - Yarn 1 update fails since 42.68.5 (regression)
- [#44498](https://github.com/renovatebot/renovate/issues/44498) - GitLab MR-creation race: 400 immediately after a successful push
- [#44465](https://github.com/renovatebot/renovate/issues/44465) - `.npmrc` auth lines with spaces bypass env-var stripping (also `security-supply-chain`, as the bypass exposes credentials)

Not this bucket:

- "X fails with no warning / silently does nothing" → `predictability`
- "Renovate doesn't support X's new format" → `ecosystem-depth` (capability gap, not defect)
- "Renovate handles X wrongly" where X is a layout, syntax or setting the Manager never modelled (quoted versions, a wrapper version taken from a catalog, an OCI source for a tool that only knew HTTP) → `ecosystem-depth`. It is a `bug-fix` only if the same input used to work, or the docs say it is supported
- Changing a Manager's default to match how its ecosystem works (carries `breaking`) → `ecosystem-depth`, even when titled `fix(…)`

## `bucket:engineering-health`

**Test:** maintainer-facing investment with no direct user-visible feature - deprecation removals (the `breaking` queue), refactors, lint rules, CI, test coverage, shrinking Renovate's own dependency tree.

Belongs here:

- [#40847](https://github.com/renovatebot/renovate/issues/40847) - Remove deprecated features (umbrella, e.g. [#40851](https://github.com/renovatebot/renovate/issues/40851) `@breejs/later` syntax)
- [#39544](https://github.com/renovatebot/renovate/discussions/39544) - Replace bunyan with Pino
- [#42814](https://github.com/renovatebot/renovate/issues/42814) - Upgrade to Zod v4
- [#42324](https://github.com/renovatebot/renovate/issues/42324) - Lint rule to enforce `.ts` suffix on imports
- [#40625](https://github.com/renovatebot/renovate/issues/40625) - Restore 100% test coverage

Not this bucket:

- `renovate[bot]`'s own update PRs → `dependency-updates`
- A deprecation removal that changes user behavior stays here, but must also carry `breaking`
- New internal modules are split by what ships: for the Enrichment module ([#40048](https://github.com/renovatebot/renovate/issues/40048)), the no-op wiring ([#42420](https://github.com/renovatebot/renovate/issues/42420)) and moving existing features onto it ([#42421](https://github.com/renovatebot/renovate/issues/42421) Merge Confidence) are `engineering-health`, while pieces that surface new data to users take the bucket of what they surface

## `bucket:docs`

**Test:** the output from this change is something users _read_ - key-concept pages, deep dives, clarifications, restructuring, and generated reference material such as the JSON schema, option tables and `--help` text.

Generated reference material counts as `docs` even when the fix is in code (e.g. option metadata or types), because what ships is documentation. Work on the docs _build_ or site tooling is `engineering-health`.

If the confusion is better fixed by a validation error or warning, it's `predictability` instead.

Belongs here:

- [#46376](https://github.com/renovatebot/renovate/issues/46376) - "Key concept" page for Vulnerability Alerts
- [#43684](https://github.com/renovatebot/renovate/issues/43684) - Deep dive on how Git is called
- [#41874](https://github.com/renovatebot/renovate/issues/41874) - Docs "overhaul" epic
- [#42073](https://github.com/renovatebot/renovate/issues/42073) - LLM-friendly documentation for config options
- [#46699](https://github.com/renovatebot/renovate/pull/46699) - `fix(config): document where options can be set` (schema metadata users read; a `fix(…)` type, but the deliverable is reference docs)

Not this bucket:

- A `docs:` PR that changes the docs build or site tooling → `engineering-health`

- [#43741](https://github.com/renovatebot/renovate/discussions/43741) "regex fails silently" → `predictability` (docs would paper over a fixable silence)
- Docs shipped alongside a new manager → stay with the feature's bucket

## `bucket:dependency-updates`

**Test:** Updates to Renovate's own dependency tree - via `renovate[bot]`.

As this is fully automated, we exclude it from every incoming-work view - it's unplanned, but expected, work.

Human work on the dependency tree (e.g. [#42864](https://github.com/renovatebot/renovate/issues/42864) "Reduce dependencies") is `engineering-health`, not this.

## Items that don't get a bucket

Buckets describe _work_.
Leave an item without a bucket (and don't force-fit `bug-fix`) when it is:

- a usage question or support request with no defect or feature in it (many "Request Help" discussions)
- an item whose _kind_ of work can't be determined until missing logs, a reproduction or details arrive
- a maintainer or contributor announcement, or a feedback megathread

`auto:needs-details`, `auto:reproduction` and `auto:logs` are a status, not a reason to skip bucketing.
If the kind of work is already clear (e.g. [#41734](https://github.com/renovatebot/renovate/discussions/41734) "Support maven model 4.1.0" is plainly `ecosystem-depth`), bucket it by its content.

A "Request Help" discussion only gets a bucket once a maintainer has acted on it - converting it to an Issue or Idea, linking it to one, applying `auto:bug-to-idea` or `auto:docs-improvements`, closing it as a duplicate of a bucketed item, or confirming the defect.
Don't bucket it from reading the discussion alone.

The same applies whichever category a question was filed in: an Idea that asks "how do I…" with no feature in it is treated like a Request Help thread.

Mend Hosted Request discussions get `audience:mend-hosted`, and a bucket only if they describe work in this repository.

## Pull requests and duplicates

- PRs and issues authored by `renovate[bot]` (its update PRs, the Dependency Dashboard issue) are `dependency-updates`, with no further judgement.
- For other PRs, use the bucket of the item they deliver - including an item the body references with "part of #X" or "as noted in #X", not only `closes #X`.
  If there's no linked issue or discussion, infer it from the Conventional Commit type and scope: `docs` → `docs`, `chore`/`ci`/`test`/`refactor`/`build` → `engineering-health`, `perf` → `performance-scale`, `feat(presets)`/`feat(replacements)`/`fix(presets)` → `ecosystem-data`, `feat(manager/…)`/`feat(datasource/…)`/`feat(versioning/…)` → `ecosystem-depth` (or `new-ecosystem` for a new module for an ecosystem Renovate extracts nothing from), `feat(platform/…)` → `platform`, and `fix(…)` → `bug-fix`, including `fix(platform/…)`.
- The body wins over the type when they plainly disagree: a `chore` that adds a warning users will see is `predictability`; a `refactor` that adds spans or log fields is `observability`; a `fix(…)` whose body describes support that never existed (e.g. `fix(nix): support flake input updates`) is `ecosystem-depth`; a `fix(…)` that only reduces API calls or memory is `performance-scale`; a `fix(…)` that corrects the JSON schema or option reference is `docs`; a `docs:` PR that changes the docs build is `engineering-health`.
- The `presets` inference only holds for presets that encode knowledge of the package world (monorepos, replacements, package lists). Presets that encode Renovate behavior - schedules such as `schedule:officeHours`, `:semanticPrefixFixDepsChoreOthers`, `config:*` semantics - take the bucket of that behavior, usually `workflow-fit` or `predictability`.
  A _new_ `customManagers:*` preset (a regex or JSONata manager for a tool) encodes extraction logic, not package-world data: `ecosystem-depth` if the tool already has a Manager, `new-ecosystem` if it doesn't. _Correcting_ an existing one (e.g. [#36711](https://github.com/renovatebot/renovate/discussions/36711), widening the `matchStrings` in `customManagers:dockerfileVersions`) is `ecosystem-data`, like any other entry correction. A `lib/data` file that only adds entries stays `ecosystem-data`; one that enables new manager behavior takes that manager's bucket.
- A duplicate (a discussion closed as `DUPLICATE`, or one with the `duplicate` label) takes the same bucket as its canonical item, so it can still be counted. Do not count a duplicate as separate work in a bucket total. Only `new-ecosystem` counts repeat asks as a signal.
  When the canonical item isn't visible from the thread, bucket the duplicate by its own content; the counting rule still applies.

## `lifecycle` (cross-cutting flag)

**Test:** a judgement about a dependency's life and health _beyond_ updating its version - abandonment/staleness detection, replacements for renamed or relocated packages, deprecations, end-of-life data, age/adoption/health metadata surfaced to the user.
The mechanism is metadata _about_ the dependency, not a version bump of it.
Applied alongside a bucket, not instead of one.

Flag it on, with the bucket it is usually paired with:

- [#38361](https://github.com/renovatebot/renovate/discussions/38361) - Abandoned-packages detection for container images (`ecosystem-depth`)
- [#44060](https://github.com/renovatebot/renovate/issues/44060) - Auto-generate replacement updates when a Packagist-abandoned package names a successor (`ecosystem-depth`)
- [#36190](https://github.com/renovatebot/renovate/discussions/36190) - Adding a custom deprecation for a package (`workflow-fit`)
- [#42885](https://github.com/renovatebot/renovate/discussions/42885) - New field: `versionLag` (`workflow-fit`)
- [#43787](https://github.com/renovatebot/renovate/discussions/43787) - HeroDevs EOL dataset integration (`ecosystem-data`)
- ["feat(replacements): kaniko to community fork"](https://github.com/renovatebot/renovate/pull/46240) (`ecosystem-data`)

Not lifecycle:

- `minimumReleaseAge` / release-age gating → `security-supply-chain` (age as attack window, not dependency health)
- Showing release age or timestamps for an update, e.g. [#44381](https://github.com/renovatebot/renovate/discussions/44381) "Show ReleaseAge / Timestamp on Dependency Dashboard" → `observability` (it describes the update, not the dependency's health). It is lifecycle only if the age is used to judge the dependency itself, e.g. staleness or abandonment
- Changelog fetching → about the update, not the dependency's life

## `rough-edge` (cross-cutting flag)

**Test:** all three must hold:

1. the irritation comes from one of Renovate's _own surfaces_ - config discovery and validation, PR/commit presentation, the Dependency Dashboard, logs and messages, the CLI, defaults, docs, or the changes it makes to files it already manages - behaving below reasonable expectation. A gap in _ecosystem or platform_ coverage (including a missing data entry) is not a rough edge, however small
1. users hit it _repeatedly in ordinary use_
1. it's _irritating, not blocking_ - a workaround exists or you live with it, and there are no failed runs, data loss or security exposure

If any one fails it isn't a rough edge.
Applied alongside a bucket, not instead of one.

The size of the fix is not a test: a rough edge may need a design decision, or touch several platforms.
Record effort separately (e.g. `good first issue`) - "quick wins" are rough edges that are also small, not the definition of a rough edge.

For (1), ask "whose surface is this?".
For example, `.jsonc` config files not being discovered ([#38060](https://github.com/renovatebot/renovate/discussions/38060)) reads like "add support for a filename", but config discovery is often the first interaction a user has with Renovate: a user reasonably expects `renovate.jsonc` to work, and Renovate silently ignores it so the repo looks unconfigured.
Renovate also silently ignores bun catalogs ([#36886](https://github.com/renovatebot/renovate/discussions/36886)), but that silence is about an ecosystem Renovate doesn't yet model, so it's a coverage gap.
The fix may well be a new config option, but the flag applies when the irritation comes from Renovate's own surface.

Many `predictability` items (e.g. silently ignoring something) will also be rough edges almost by definition - that's expected, and `rough-edge` with `predictability` is where the highest-value fixes tend to sit.

Evidence for (2) can be reactions, upvotes, comment count, duplicate asks, or a maintainer recognising it as a common irritation.
Most items have little engagement, so low engagement alone doesn't disqualify an item - judge whether ordinary use would hit it repeatedly.
PRs have no engagement signal, so judge them on the same three tests as the issue they fix.

For (2), "repeatedly in ordinary use" means in the normal update loop.
Something seen once per repository (onboarding text, a one-off migration message) or only during a platform outage fails (2).

For (3), "failed runs" means a Renovate run against a repository failing or producing nothing.
A red job in the user's own CI caused by one of Renovate's tools behaving below expectation (e.g. `renovate-config-validator` ignoring configured credentials, [#12272](https://github.com/renovatebot/renovate/issues/12272)) is an irritation with a workaround, and passes (3).
Changes Renovate makes to files it manages that trip the user's own lint or formatting on every PR also pass (3): the run succeeded, the user is just irritated.
Only _exposure_ excludes a security-themed item: a non-blocking irritation from a security feature is still a rough edge.

Flag it on:

- [#45092](https://github.com/renovatebot/renovate/discussions/45092) - `commitMessageSuffix` gets an auto-inserted space you can't suppress
- [#35156](https://github.com/renovatebot/renovate/discussions/35156) - "Compare Source" links use `...` instead of `..`
- [#41466](https://github.com/renovatebot/renovate/issues/41466) / [#41467](https://github.com/renovatebot/renovate/issues/41467) - hidden-unicode warning fires on binary files and spams the dashboard
- [#40144](https://github.com/renovatebot/renovate/issues/40144) / [#40143](https://github.com/renovatebot/renovate/issues/40143) - `--help` doesn't show defaults or allowed values
- [#38060](https://github.com/renovatebot/renovate/discussions/38060) / [#40868](https://github.com/renovatebot/renovate/discussions/40868) - `.jsonc` config files not discovered (config discovery is Renovate's own surface)
- [#42367](https://github.com/renovatebot/renovate/discussions/42367) - config file in a `.config/` directory not discovered
- [#37150](https://github.com/renovatebot/renovate/discussions/37150) - `postUpdateOptions` can't be set by an environment variable
- [#39050](https://github.com/renovatebot/renovate/discussions/39050) - autoclosed PRs get "- autoclosed" in the title instead of a label (needs a design decision, but the irritation is current behavior)
- [#35164](https://github.com/renovatebot/renovate/discussions/35164) - hard-coded config migration commit message (the fix is a new option, but the irritation is current behavior)
- [#35344](https://github.com/renovatebot/renovate/discussions/35344) - gomod updates touch the `go`/`toolchain` directives (Renovate already acts here, and acts annoyingly)
- [#18011](https://github.com/renovatebot/renovate/discussions/18011) - redundant stability-days check (security-themed, but no exposure)

Not a rough edge:

- [#36886](https://github.com/renovatebot/renovate/discussions/36886) "Support bun catalogs" → ecosystem coverage gap, not Renovate's own surface (fails 1)
- Adding a new `ecosystem-data` entry (e.g. a monorepo grouping) → missing data entry (fails 1). Only flag an `ecosystem-data` item when it corrects an existing entry that was causing irritation
- [#36695](https://github.com/renovatebot/renovate/discussions/36695) "trailing comma times out after 30 minutes" → a failed run, not an irritation (fails 3)
- [#40294](https://github.com/renovatebot/renovate/issues/40294) "Yarn 1 update fails since 42.68.5" → blocking regression (fails 3)
- [#41636](https://github.com/renovatebot/renovate/discussions/41636) "markdown badges expose internal package names" → security exposure (fails 3)

## Audience label family (one per item)

Unlike bucket, audience is a single label per item, and helps define who this Discussion/Issue/PR is for.

Audience follows who _feels the result_, not who does the work: an `engineering-health` refactor that changes a user-facing config option, a tool users run, or the generated docs is `audience:user`; `docs` items take the audience of the readers, not the writers.
Where a reporter runs Renovate (self-hosted, or the Mend-hosted app) does not decide audience on its own.

### `audience:user` (default)

**Test:** would this be configured in, or experienced through, repository config - the PRs Renovate raises, `renovate.json`, grouping, scheduling, presentation?

Repository config includes the shared presets a repository extends and config an org inherits into its repositories (for example via `extends` from an org preset or `inheritConfig`): the people who write those are users too, just at a wider scope than one repository.
Bugs in the PRs Renovate raises are `audience:user` wherever the Renovate deployment runs, and a self-hosting reporter does not make an item operator-facing.

### `audience:operator`

**Test:** does this live in global config, environment, credentials infrastructure, or affect how the Renovate deployment instance (not one repo) behaves - autodiscovery, scaling, CI resource use, fleet admin, run modes such as `dryRun` and `platform=local`? When torn with user, ask where the config key lives: repo config → user, global-only → operator.

For keys allowed in both (`hostRules`, `binarySource`, `packageRules`), ask who sets it in practice: credentials, tool installation and bot-wide limits → operator; anything about which updates get raised and how → user.
Host rules and credentials are `operator` by default; only an ask about _suggesting_ them from repo config is `user`.
Tool installation and invocation (`binarySource`, install mirrors, "No tool releases found") are `operator` even though a user sees the breakage, because the fix is in the instance.
Caching and API-traffic work is `operator` unless the item is about a wrong result.

e.g. TypeScript self-hosted config, Redis IAM auth, autodiscover sharding, "maximum values for user-configurable options", automatic offboarding.

### `audience:mend-hosted`

**Test:** specific to the Mend-hosted app's behavior or constraints, not reproducible on plain self-hosted - the hosted app's job timeouts, its token model, the developer portal.

"How are you running Renovate: Mend-hosted app" in a Request Help template does not decide audience: if the same config and repository would fail on self-hosted, it is `audience:user` (or `operator`).

### `audience:maintainer`

**Test:** things that the Renovate maintainers (or collaborators) need done - repo CI, refactors, test tooling, release process - and nothing a user or operator would notice.
