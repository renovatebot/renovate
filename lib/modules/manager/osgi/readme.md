The `osgi` manager extracts dependencies from feature model definition files, typically located under `src/main/features`.
It uses the `maven` datasource to find dependency updates.

Artifact list extensions are not supported.
For the definition of artifact list extensions, read [section 159.7.3 of the OSGi R8 spec](https://docs.osgi.org/specification/osgi.cmpn/8.0.0/service.feature.html#d0e156801).

References:

- [OSGi compendium release 8, Feature Service Specification](https://docs.osgi.org/specification/osgi.cmpn/8.0.0/service.feature.html)
- [The Sling implementation of the feature model](https://sling.apache.org/documentation/development/feature-model.html)
