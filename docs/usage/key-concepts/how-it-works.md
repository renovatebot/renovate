---
title: How it works ?
description: Learn all about Renovate's workflow
---

# Introduction

Renovate works by searching for all the dependencies in your project and then look for updates for each.

To be compatible with the variety of dependency-naming and versioning conventions, Renovate has defined modules for each known convention, and you can define your own too.

## Core

The core of renovate is responsible for the global workflow

## Modules

The three modules are: [manager](../modules/manager/index.md), [datasource](../modules/datasource/index.md) and [versioning](../modules/versioning.md).

They are used sequentially:

1. the manager module looks for files based on their name and extract dependencies from them, each dependency has a datasource
2. the datasource module looks for the existing versions of the dependency
3. the versioning module search for a valid version regarding the dependency's version

For example:

1. the `gitlabci` manager finds a dependency named `python:3.10-alpine` of datasource `docker`
2. the `docker` datasource looks for versions and finds `[python:3.9,python:3.9-alpine,python:3.10,python:3.10-alpine,python:3.11,python:3.11-alpine]`
3. the `docker` versioning takes `python:3.11-alpine` as it is compatible with `python:3.10-alpine`

# Workflow

## Basic

Here's a high-level overview of the renovate workflow, collect dependencies then update them:

```mermaid
flowchart LR
  subgraph COLLECT
    direction TB
    CC[[For each manager]]
    CC -->|managerA| CD["..."]
    CC -->|managerB| CCF["collect files"]

    CCF --> CFEF[[For each file]]

    CFEF -->|file1| CCD1[Collect dependency]
    CFEF -->|file2| CCD2[...]
  end

  subgraph UPDATE
    direction TB

    UC[[For each manager]]
    UC -->|managerA| UD["..."]
    UC -->|managerB| UFEF[[For each file]]

    UFEF -->|file1| FED[[For each dependency]]
    UFEF -->|file2| FED2[...]


    FED -->|dep1| D1[...]
    D1 -..-> CU
    FED -->|dep2| D2[use datasource to\n get possible updates]
    D2 --> J[use versionning to find \n next valid update]

    FED2 -...-> CU

    UD -....-> CU
    J --> CU[Collect updates]

    CU --> FEU[[For each update]]

    FEU --> AU[Create branch\nApply update\nSetup PR]

  end

  COLLECT --> UPDATE
```

## Advanced

And here's a mode detailed view of the workflow:

```mermaid
flowchart TB
    subgraph INITIALIZATION
        direction TB
        MC[Merge configuration sources \n most important to least: \n cli > env > file > default]
        MC --> IP[Initialize platform]
        IP --> AD[Query the platform for repositories]
        AD --> NFIL[Narrow the list with filters]
    end

    subgraph REPOSITORY
       direction TB
       FER[[For each repository]]

      subgraph COLLECTD[COLLECT DEPENDENCIES]
          direction TB
          CLBRANCH[Collect existing branches]
          CLBRANCH --> VULN[Check for vulnerabilities]
          VULN --> CC[[For each manager]]
          CC -->|managerA| CD["..."]
          CC -->|managerB| CCF["collect files"]
          CCF --> CFEF[[For each file]]
          CFEF -->|file1| CCD1[Collect dependency]
          CFEF -->|file2| CCD2[...]
      end

      subgraph COLLECTU[COLLECT UPDATES]
          direction TB
          UC[[For each manager]]
          UC -->|managerA| UD["..."]
          UC -->|managerB| UFEF[[For each file]]
          UFEF -->|file1| FED[[For each dependency]]
          UFEF -->|file2| FED2[...]
          FED -->|dep1| D1[...]
          D1 -..-> CU
          FED -->|dep2| D2[use datasource to \n get possible updates]
          D2 --> J[use versionning to find \n next valid update]
          FED2 -...-> CU
          UD -....-> CU
          J --> CU[Collect updates]
      end

      subgraph WRITEU[WRITE UPDATES]
        direction TB
        FEU[[For each update]]
        FEU --> AUCOND[Check if branch needed: \n existing/rebase/concurrent amount]
        AUCOND --> AU[Create branch\nApply update\nSetup PR]
      end

      subgraph FINALIZE[FINALIZE]
      direction TB
        CM[Check for config migration]
        CM --> CSB[Clean stale branches]

      end

      FER --> IRPO[Initialize repository]

      IRPO --> COLLECTD
      COLLECTD --> COLLECTU

      COLLECTU --> WRITEU

      WRITEU --> FINALIZE

    end

    INITIALIZATION --> REPOSITORY
```
