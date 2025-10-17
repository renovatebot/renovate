This manager maintains `.devbox-version` files. Available versions will be determined from the official Devbox releases endpoint.

The `.devbox-version` file contains a single version string that specifies which version of Devbox to use for the project. This manager will check for newer versions and propose updates when available.

Example `.devbox-version` file:

```
0.16.0
```
