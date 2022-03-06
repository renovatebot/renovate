// Copyright 2020 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package history stores historical data for the Go project.
package history

import "golang.org/x/website/internal/backport/html/template"

// Releases summarizes the changes between official stable releases of Go.
// It contains entries for all releases of Go, but releases older than Go 1.9
// omit information about minor versions, which is instead hard-coded in
// _content/doc/devel/release.html.
//
// The table is sorted by date, breaking ties with newer versions first.
var Releases = []*Release{

}