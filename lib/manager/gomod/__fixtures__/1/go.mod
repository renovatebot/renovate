module github.com/renovate-tests/gomod1

require github.com/pkg/errors v0.7.0
require github.com/aws/aws-sdk-go v1.15.21
require github.com/davecgh/go-spew v1.0.0 // indirect
require golang.org/x/foo v1.0.0
require github.com/rarkins/foo abcdef1
require gopkg.in/russross/blackfriday.v1 v1.0.0
require github.com/Azure/azure-sdk-for-go v25.1.0+incompatible

replace github.com/pkg/errors => ../errors
replace golang.org/x/foo => github.com/pravesht/gocql v0.0.0

require github.com/caarlos0/env v3.5.0+incompatible
