This datasource will default to using the `GOPROXY` settings `https://proxy.golang.org,direct` if there is no value defined in environment variables.

To override this default and use a different proxy, simply configure `GOPROXY` to an alternative setting in env.

To override this default and stop using any proxy at all, set `GOPROXY` to the value `direct`.
