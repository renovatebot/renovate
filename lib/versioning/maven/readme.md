# Maven versioning

## Documentation and URLs

https://maven.apache.org/pom.html#Dependency_Version_Requirement_Specification
https://octopus.com/blog/maven-versioning-explained
https://maven.apache.org/enforcer/enforcer-rules/versionRanges.html

## What type of versioning is used?

Maven's versioning is similar to semver but also very different in places. It's specified by Maven itself.

## Are ranges supported? How?

Yes, Maven uses its own special syntax for ranges.

## Range Strategy support

npm versioning should support all range strategies - pin, replace, bump, extend.

## Implementation plan/status

- [x] Exact version support
- [ ] Range support (#2986)
