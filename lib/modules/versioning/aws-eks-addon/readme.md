AWS versioning syntax is used for EKS Addon updates.

It is based off [Semantic Versioning 2.0](https://semver.org) but with a subset of addon `build metadata` syntax.

At the moment every ESK Addon that matches the regex `^v?\d+\.\d+\.\d+-eksbuild\.\d+$` is considered a valid "release".

**Key Points about EKS Addon Versioning**

1. Versioning Scheme: Add-ons typically follow a semantic versioning scheme (e.g., Major.Minor.Patch). This helps in understanding the significance of changes between versions:
   - `Major`: Indicates significant changes or breaking API changes for plugin version.
   - `Minor`: Introduces new features or enhancements for plugin version.
   - `Patch`: Includes bug fixes and minor improvements for plugin version.
   - `Build Metadata` : It helps differentiate this particular release from others that might have been built independently.

2. Default Versions: When creating a new EKS cluster, AWS often selects a default version for each addon based on the cluster's Kubernetes version and other factors. This default version is usually the most stable and recommended for the specific cluster configuration

3. Build metadata. Example `eksbuild.1`. The `eksbuild.1` part signifies a specific build or release within the `1.19.0` version, likely managed by the EKS build system. It helps differentiate this particular release from others that might have been built independently. The build metadata provides additional context about the specific release, which can be useful for tracking and troubleshooting.
