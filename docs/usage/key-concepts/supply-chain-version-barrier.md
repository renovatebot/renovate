---
title: Supply Chain Version Barrier
description: Analysis and proposal for a position-based version exclusion mechanism to complement time-based supply chain protections.
---

# Supply Chain Version Barrier

## Problem Statement

A dependency update is the primary vector for supply chain attacks.
An attacker who compromises a maintainer account, or who publishes a typosquatted package, targets the **latest release** — the version automated tooling will pick up first.

Renovate's existing `minimumReleaseAge` mitigates this by imposing a time-based quarantine.
Once that quarantine expires, the release becomes eligible regardless of whether it has been independently verified.
A patient attacker who waits out the configured window — or who compromises a package that publishes infrequently — bypasses the gate entirely.

There is currently no mechanism to say: _"never propose the absolute latest release; always stay N versions behind."_

## Existing Defenses

Renovate provides several overlapping controls that reduce supply chain exposure:

| Control                         | Mechanism                                               | Limitation                                                                |
| ------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| `minimumReleaseAge`             | Time-based quarantine (e.g. `14 days`)                  | Expires; patient attacker waits it out                                    |
| `pinDigests`                    | Immutable SHA256 digest pinning                         | Prevents tag mutation, not initial poisoning                              |
| `rangeStrategy: pin`            | Exact version lock                                      | Locks current version; does not influence _which_ new version is proposed |
| `minimumConfidence`             | Merge Confidence score from Mend                        | Requires Mend authentication; coverage limited to select datasources      |
| `ignoreUnstable`                | Filters pre-release SemVer                              | Attackers publish stable-looking versions                                 |
| `respectLatest`                 | Caps at the `latest` dist-tag                           | Attacker targets `latest` specifically                                    |
| `followTag`                     | Restricts to a named release channel                    | Only effective when upstream publishes separate stable/LTS tags           |
| `vulnerabilityAlerts`           | Immediate PRs for known CVEs                            | Reactive, not preventive                                                  |
| `security:minimumReleaseAgeNpm` | 3-day quarantine for npm, `internalChecksFilter=strict` | Hardcoded to npm; 3 days may be insufficient                              |

### The Gap

None of these controls implement a **position-based exclusion** — skipping the `N` most recent versions regardless of their age.
The distinction matters: a time gate is a decaying barrier, while a version-offset barrier is structural.

## Proposed Feature: `maxVersionsBehindLatest`

A new configuration option:

```json
{
  "maxVersionsBehindLatest": 1
}
```

**Semantics**: Given all available versions sorted by release order, exclude the newest `N` versions from consideration.
Renovate proposes the highest version that remains after exclusion.

### Interaction with `minimumReleaseAge`

The two mechanisms are complementary, not redundant:

- `minimumReleaseAge` answers: _"Is this version old enough?"_
- `maxVersionsBehindLatest` answers: _"Has this version survived being the latest?"_

A version must pass **both** gates when both are configured.
This provides defense in depth: even if a malicious release ages past the time window, it remains blocked while it is still the newest release.

### Interaction with Vulnerability Alerts

This is the critical design tension.

**The contradiction**: supply chain defense says _"don't trust the latest release."_
Vulnerability remediation says _"adopt the fix release immediately."_
These appear mutually exclusive.

**Resolution**: Renovate already solves this at the configuration layer.
The `vulnerabilityAlerts` default config object overrides `minimumReleaseAge` to `null`, bypasses rate limits via `isVulnerabilityAlert`, and forces `prCreation: 'immediate'`.
The same pattern applies to `maxVersionsBehindLatest`:

```json
{
  "vulnerabilityAlerts": {
    "maxVersionsBehindLatest": null,
    "minimumReleaseAge": null,
    "prCreation": "immediate"
  }
}
```

When a version is proposed **because it fixes a known CVE**, the barrier is lifted.
The vulnerability alert path is fundamentally different from the general update path — it is triggered by advisory data (GitHub, OSV), not by version discovery alone.

**Residual risk**: a zero-day supply chain attack disguised as a security fix.
A compromised maintainer could publish a malicious patch and simultaneously file a CVE.
Neither time-based nor position-based barriers fully address this — only independent verification (digest pinning, reproducible builds, Gradle `verification-metadata.xml`) can.
This is an inherent limitation of any automated dependency update system.

### Interaction with `internalChecksFilter`

`maxVersionsBehindLatest` integrates with the existing `internalChecksFilter` behavior:

| `internalChecksFilter` | Behavior when all eligible versions are excluded |
| ---------------------- | ------------------------------------------------ |
| `strict`               | No branch or PR is created                       |
| `flexible`             | Falls back to the highest available version      |
| `none`                 | Ignores the barrier entirely                     |

### Scope and Applicability

Like `minimumReleaseAge`, this option should be:

- Configurable globally, per-manager, per-datasource, or per-package via `packageRules`
- Ineffective for `lockFileMaintenance`, `replacement`, `pin`, and `rollback` update types (the package manager controls these)
- Bypassed by `vulnerabilityAlerts` by default
- Dependent on the datasource providing ordered release data (same prerequisite as `minimumReleaseAge`)

### Example Configuration

Defense-in-depth setup combining time-based and position-based barriers:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:best-practices"],
  "maxVersionsBehindLatest": 1,
  "minimumReleaseAge": "7 days",
  "internalChecksFilter": "strict",
  "packageRules": [
    {
      "description": "Relax barrier for trusted internal packages",
      "matchPackageNames": ["@my-org/*"],
      "maxVersionsBehindLatest": null,
      "minimumReleaseAge": null
    }
  ]
}
```

## Risk Assessment

### Risks Addressed

1. **Immediate poisoning**: a malicious version is never adopted while it is the latest release, buying time for detection by security researchers, registry scanners, or Merge Confidence data.
2. **Quarantine expiry**: unlike `minimumReleaseAge`, the barrier does not decay with time — it is structural until a newer release displaces it.
3. **Infrequent publishers**: packages with long release cycles leave `minimumReleaseAge` ineffective (the malicious version ages out quickly relative to the release cadence). A position-based barrier remains effective.

### Risks Introduced

1. **Delayed CVE fixes**: mitigated by the `vulnerabilityAlerts` bypass. Without it, a security fix that is also the latest release would be blocked.
2. **Stale dependencies**: with `maxVersionsBehindLatest=1`, a package that publishes a single new version and then goes dormant will never be adopted. The `abandonmentThreshold` option partially addresses this.
3. **Complexity**: another knob in an already feature-rich configuration surface. Should ship with a ready-to-use preset (e.g. `security:versionBarrier`).

### Comparison Matrix

| Attack scenario                          | `minimumReleaseAge` | `maxVersionsBehindLatest` |                Both                 |
| ---------------------------------------- | :-----------------: | :-----------------------: | :---------------------------------: |
| Malicious release, detected within days  |         ✅          |            ✅             |                 ✅                  |
| Malicious release, detected after weeks  |         ❌          |            ✅             |                 ✅                  |
| Malicious release on infrequent package  |         ❌          |            ✅             |                 ✅                  |
| Tag mutation attack (Docker)             |         ❌          |            ❌             |        ❌ (use `pinDigests`)        |
| CVE fix available as latest-only release |  ✅ (vuln bypass)   |     ✅ (vuln bypass)      |                 ✅                  |
| Compromised maintainer files fake CVE    |         ❌          |            ❌             | ❌ (needs independent verification) |

## Implementation Notes

The version-offset filter belongs in the same lookup phase as `minimumReleaseAge`: `lib/workers/repository/process/lookup/filter-checks.ts`.
The existing loop iterates releases from highest to lowest; adding a counter-based skip before the age check is a minimal change.

The `vulnerabilityAlerts` config bypass requires no code change — setting `maxVersionsBehindLatest: null` in the `vulnerabilityAlerts` default object (alongside the existing `minimumReleaseAge: null`) is sufficient.

A preset should be provided:

```ts
// lib/config/presets/internal/security.preset.ts
versionBarrier: {
  description:
    'Skip the latest release of each dependency, requiring at least one subsequent release before adoption.',
  maxVersionsBehindLatest: 1,
  internalChecksFilter: 'strict',
},
```

## Related

- [Minimum Release Age](./minimum-release-age.md) — time-based quarantine mechanism
- [Merge Confidence](../merge-confidence.md) — community-sourced update safety data
- [Upgrade Best Practices](../upgrade-best-practices.md) — recommends 14-day wait before automerge
- [Security and Permissions](../security-and-permissions.md) — threat model for self-hosted instances
- [Swissquote User Story](../user-stories/swissquote.md) — real-world supply chain risk experience
