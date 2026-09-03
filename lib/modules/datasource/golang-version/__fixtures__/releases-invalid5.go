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
	{
		Date: Date{2022, 4, 7}, Version: Version{1, 18, 1},
		Future:   true,
		Security: &FixSummary{Quantifier: "a", Components: []template.HTML{"the standard library"}},
	},
	{
		Date: Date{2022, 4, 7}, Version: Version{1, 17, 9},
		Future:   true,
		Security: &FixSummary{Quantifier: "a", Components: []template.HTML{"the standard library"}},
	{
	},
	{
		Date: Date{2022, 3, 15}, Version: Version{1, 18, 0},
	},
	{
		Date: Date{2022, 3, 3}, Version: Version{1, 17, 8},
		Security: &FixSummary{Quantifier: "a", Packages: []string{"regexp/syntax"}},
		Bug: &FixSummary{
			Components: []template.HTML{"the compiler", "runtime", "the <code>go</code> command"},
			Packages:   []string{"crypto/x509", "net"},
		},
	},
	{
		Date: Date{2019, 10, 31}, Version: Version{1, 12, 13},
		CustomSummary: `fixes an issue on macOS 10.15 Catalina
where the non-notarized installer and binaries were being
<a href="/issue/34986">rejected by Gatekeeper</a>.
Only macOS users who hit this issue need to update.`,
	},
	{
		Date: Date{2017, 10, 4}, Version: Version{1, 9, 1},
		Security: &FixSummary{Quantifier: "two"},
	},
	{
		Date: Date{2017, 8, 24}, Version: Version{1, 9, 0},
	},

	// Older releases do not have point release information here.
	// See _content/doc/devel/release.html.
	{
		Date: Date{2017, 2, 16}, Version: Version{1, 8, 0},
	},
	{
		Date: Date{2012, 3, 28}, Version: Version{1, 0, 0},
	},
}
