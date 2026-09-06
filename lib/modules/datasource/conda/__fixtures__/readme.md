# Conda fixtures

`pytest.json` contains a response body from https://api.anaconda.org/package/main/pytest, but the `files` key has been truncated to one element as it is huge and not needed for Renovate.

`repodata.json` is a hand-written index in the shape a conda channel serves, trimmed to the few packages the tests need.
