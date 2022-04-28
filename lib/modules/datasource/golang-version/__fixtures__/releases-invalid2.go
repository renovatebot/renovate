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
        Date: Date{2021, 12, 9}, Version: Version{1, 17, 5},
        CustomSummary: `includes security fixes to the <code>syscall</code> and <code>net/http</code> packages.
See the <a href="https://github.com/golang/go/issues?q=milestone%3AGo1.17.5+label%3ACherryPickApproved">Go 1.17.5 milestone</a> on our issue tracker for details.`,
    {
        Date: Date{2021, 12, 2}, Version: Version{1, 17, 4},
        Components: []template.HTML{"the compiler", "linker", "runtime"},
        Packages:   []string{"go/types", "net/http", "time"},
    },
    {
        Date: Date{2021, 12, 2}, Version: Version{1, 16, 11},
        Components: []template.HTML{"the compiler", "runtime"},
        Packages:   []string{"net/http", "net/http/httptest", "time"},
    },
    {
        Date: Date{2021, 11, 4}, Version: Version{1, 17, 3},
        CustomSummary: `includes security fixes to the <code>archive/zip</code> and <code>debug/macho</code> packages,
as well as bug fixes to the compiler, linker, runtime, the <code>go</code> command, the <code>misc/wasm</code> directory, and to the <code>net/http</code> and <code>syscall</code> packages.
See the <a href="https://github.com/golang/go/issues?q=milestone%3AGo1.17.3+label%3ACherryPickApproved">Go 1.17.3 milestone</a> on our issue tracker for details.`,
    },
    {
        Date: Date{2021, 11, 4}, Version: Version{1, 16, 10},
        CustomSummary: `includes security fixes to the <code>archive/zip</code> and <code>debug/macho</code> packages,
as well as bug fixes to the compiler, linker, runtime, the <code>misc/wasm</code> directory, and to the <code>net/http</code> package.
See the <a href="https://github.com/golang/go/issues?q=milestone%3AGo1.16.10+label%3ACherryPickApproved">Go 1.16.10 milestone</a> on our issue tracker for details.`,
    },
    {
        Date: Date{2021, 10, 7}, Version: Version{1, 17, 2},
        CustomSummary: `includes a security fix to the linker and <code>misc/wasm</code> directory,
as well as bug fixes to the compiler, the runtime, the <code>go</code> command, and to the <code>time</code> and <code>text/template</code> packages.
See the <a href="https://github.com/golang/go/issues?q=milestone%3AGo1.17.2+label%3ACherryPickApproved">Go
1.17.2 milestone</a> on our issue tracker for details.`,
    },
    {
        Date: Date{2021, 10, 7}, Version: Version{1, 16, 9},
        CustomSummary: `includes a security fix to the linker and <code>misc/wasm</code> directory,
as well as bug fixes to the runtime and to the <code>text/template</code> package.
See the <a href="https://github.com/golang/go/issues?q=milestone%3AGo1.16.9+label%3ACherryPickApproved">Go
1.16.9 milestone</a> on our issue tracker for details.`,
    },
    {
        Date: Date{2021, 9, 9}, Version: Version{1, 17, 1},
        CustomSummary: `includes a security fix to the <code>archive/zip</code> package,
as well as bug fixes to the compiler, linker, the <code>go</code> command, and to the <code>crypto/rand</code>, <code>embed</code>, <code>go/types</code>, <code>html/template</code>, and <code>net/http</code> packages.
See the <a href="https://github.com/golang/go/issues?q=milestone%3AGo1.17.1+label%3ACherryPickApproved">Go
1.17.1 milestone</a> on our issue tracker for details.`,
    },
    {
        Date: Date{2021, 9, 9}, Version: Version{1, 16, 8},
        CustomSummary: `includes a security fix to the <code>archive/zip</code> package,
as well as bug fixes to the <code>archive/zip</code>, <code>go/internal/gccgoimporter</code>, <code>html/template</code>, <code>net/http</code>, and <code>runtime/pprof</code> packages.
See the <a href="https://github.com/golang/go/issues?q=milestone%3AGo1.16.8+label%3ACherryPickApproved">Go
1.16.8 milestone</a> on our issue tracker for details.`,
    },
    {
        Date: Date{2021, 8, 16}, Version: Version{1, 17, 0},
    },
    {
        Date: Date{2021, 8, 5}, Version: Version{1, 16, 7},
        CustomSummary: `includes a security fix to the <code>net/http/httputil</code> package,
as well as bug fixes to the compiler, the linker, the runtime, the <code>go</code> command,
and the <code>net/http</code> package. See the
<a href="https://github.com/golang/go/issues?q=milestone%3AGo1.16.7+label%3ACherryPickApproved">Go
1.16.7 milestone</a> on our issue tracker for details.`,
    },
    {
        Date: Date{2021, 8, 5}, Version: Version{1, 15, 15},
        CustomSummary: `includes a security fix to the <code>net/http/httputil</code> package,
as well as bug fixes to the compiler, the runtime, the <code>go</code> command, and the
<code>net/http</code> package. See the
<a href="https://github.com/golang/go/issues?q=milestone%3AGo1.15.15+label%3ACherryPickApproved">Go
1.15.15 milestone</a> on our issue tracker for details.`,
    },
    {
        Date: Date{2021, 7, 12}, Version: Version{1, 16, 6},
        CustomSummary: `includes a security fix to the <code>crypto/tls</code> package,
as well as bug fixes to the compiler, and the <code>net</code> and <code>net/http</code> packages. See the
<a href="https://github.com/golang/go/issues?q=milestone%3AGo1.16.6+label%3ACherryPickApproved">Go
1.16.6 milestone</a> on our issue tracker for details.`,
    },
    {
        Date: Date{2021, 7, 12}, Version: Version{1, 15, 14},
        CustomSummary: `includes a security fix to the <code>crypto/tls</code> package,
as well as bug fixes to the linker, and the <code>net</code> package. See the
<a href="https://github.com/golang/go/issues?q=milestone%3AGo1.15.14+label%3ACherryPickApproved">Go
1.15.14 milestone</a> on our issue tracker for details.`,
    },
    {
        Date: Date{2021, 6, 3}, Version: Version{1, 16, 5},
        CustomSummary: `includes security fixes to the
<code>archive/zip</code>, <code>math/big</code>,
<code>net</code>, and <code>net/http/httputil</code> packages,
as well as bug fixes to the linker, the <code>go</code> command,
and the <code>net/http</code> package. See the
<a href="https://github.com/golang/go/issues?q=milestone%3AGo1.16.5+label%3ACherryPickApproved">Go
1.16.5 milestone</a> on our issue tracker for details.`,
    },
    {
        Date: Date{2021, 6, 3}, Version: Version{1, 15, 13},
        CustomSummary: `includes security fixes to the
<code>archive/zip</code>, <code>math/big</code>,
<code>net</code>, and <code>net/http/httputil</code> packages,
as well as bug fixes to the linker, the <code>go</code> command,
and the <code>math/big</code> and <code>net/http</code> packages. See the
<a href="https://github.com/golang/go/issues?q=milestone%3AGo1.15.13+label%3ACherryPickApproved">Go
1.15.13 milestone</a> on our issue tracker for details.`,
    },
    {
        Date: Date{2021, 5, 6}, Version: Version{1, 16, 4},
        CustomSummary: `includes a security fix to the
<code>net/http</code> package, as well as bug fixes to the runtime,
the compiler, and the <code>archive/zip</code>, <code>time</code>,
and <code>syscall</code> packages. See the
<a href="https://github.com/golang/go/issues?q=milestone%3AGo1.16.4+label%3ACherryPickApproved">Go
1.16.4 milestone</a> on our issue tracker for details.`,
    },
    {
        Date: Date{2021, 5, 6}, Version: Version{1, 15, 12},
        CustomSummary: `includes a security fix to the
<code>net/http</code> package, as well as bug fixes to the runtime,
the compiler, and the <code>archive/zip</code>, <code>time</code>,
and <code>syscall</code> packages. See the
<a href="https://github.com/golang/go/issues?q=milestone%3AGo1.15.12+label%3ACherryPickApproved">Go
1.15.12 milestone</a> on our issue tracker for details.`,
    },
    {
        Date: Date{2021, 4, 1}, Version: Version{1, 16, 3},
        Components: []template.HTML{"the compiler", "linker", "runtime", "the <code>go</code> command"},
        Packages:   []string{"testing", "time"},
    },
    {
        Date: Date{2021, 4, 1}, Version: Version{1, 15, 11},
        Components: []template.HTML{"cgo", "the compiler", "linker", "runtime", "the <code>go</code> command"},
        Packages:   []string{"database/sql", "net/http"},
    },
    {
        Date: Date{2021, 3, 11}, Version: Version{1, 16, 2},
        Components: []template.HTML{"cgo", "the compiler", "linker", "the <code>go</code> command"},
        Packages:   []string{"syscall", "time"},
    },
    {
        Date: Date{2021, 3, 11}, Version: Version{1, 15, 10},
        Components: []template.HTML{"the compiler", "the <code>go</code> command"},
        Packages:   []string{"net/http", "os", "syscall", "time"},
    },
    {
        Date: Date{2021, 3, 10}, Version: Version{1, 16, 1}, Security: true,
        Packages: []string{"archive/zip", "encoding/xml"},
    },
    {
        Date: Date{2021, 3, 10}, Version: Version{1, 15, 9}, Security: true,
        Packages: []string{"encoding/xml"},
    },
    {
        Date: Date{2021, 2, 16}, Version: Version{1, 16, 0},
    },
    {
        Date: Date{2021, 2, 4}, Version: Version{1, 15, 8},
        Components: []template.HTML{"the compiler", "linker", "runtime", "the <code>go</code> command"},
        Packages:   []string{"net/http"},
    },
    {
        Date: Date{2021, 2, 4}, Version: Version{1, 14, 15},
        Components: []template.HTML{"the compiler", "runtime", "the <code>go</code> command"},
        Packages:   []string{"net/http"},
    },
    {
        Date: Date{2021, 1, 19}, Version: Version{1, 15, 7}, Security: true,
        Components: []template.HTML{"the <code>go</code> command"},
        Packages:   []string{"crypto/elliptic"},
    },
    {
        Date: Date{2021, 1, 19}, Version: Version{1, 14, 14}, Security: true,
        Components: []template.HTML{"the <code>go</code> command"},
        Packages:   []string{"crypto/elliptic"},
    },
    {
        Date: Date{2020, 12, 3}, Version: Version{1, 15, 6},
        Components: []template.HTML{"the compiler", "linker", "runtime", "the <code>go</code> command"},
        Packages:   []string{"io"},
    },
    {
        Date: Date{2020, 12, 3}, Version: Version{1, 14, 13},
        Components: []template.HTML{"the compiler", "runtime", "the <code>go</code> command"},
    },
    {
        Date: Date{2020, 11, 12}, Version: Version{1, 15, 5}, Security: true,
        Components: []template.HTML{"the <code>go</code> command"},
        Packages:   []string{"math/big"},
    },
    {
        Date: Date{2020, 11, 12}, Version: Version{1, 14, 12}, Security: true,
        Components: []template.HTML{"the <code>go</code> command"},
        Packages:   []string{"math/big"},
    },
    {
        Date: Date{2020, 11, 5}, Version: Version{1, 15, 4},
        Components: []template.HTML{"cgo", "the compiler", "linker", "runtime"},
        Packages:   []string{"compress/flate", "net/http", "reflect", "time"},
    },
    {
        Date: Date{2020, 11, 5}, Version: Version{1, 14, 11},
        Components: []template.HTML{"the runtime"},
        Packages:   []string{"net/http", "time"},
    },
    {
        Date: Date{2020, 10, 14}, Version: Version{1, 15, 3},
        Components: []template.HTML{"cgo", "the compiler", "runtime", "the <code>go</code> command"},
        Packages:   []string{"bytes", "plugin", "testing"},
    },
    {
        Date: Date{2020, 10, 14}, Version: Version{1, 14, 10},
        Components: []template.HTML{"the compiler", "runtime"},
        Packages:   []string{"plugin", "testing"},
    },
    {
        Date: Date{2020, 9, 9}, Version: Version{1, 15, 2},
        Components: []template.HTML{"the compiler", "runtime", "documentation", "the <code>go</code> command"},
        Packages:   []string{"net/mail", "os", "sync", "testing"},
    },
    {
        Date: Date{2020, 9, 9}, Version: Version{1, 14, 9},
        Components: []template.HTML{"the compiler", "linker", "runtime", "documentation"},
        Packages:   []string{"net/http", "testing"},
    },
    {
        Date: Date{2020, 9, 1}, Version: Version{1, 15, 1}, Security: true,
        Packages: []string{"net/http/cgi", "net/http/fcgi"},
    },
    {
        Date: Date{2020, 9, 1}, Version: Version{1, 14, 8}, Security: true,
        Packages: []string{"net/http/cgi", "net/http/fcgi"},
    },
    {
        Date: Date{2020, 8, 11}, Version: Version{1, 15, 0},
    },
    {
        Date: Date{2020, 8, 6}, Version: Version{1, 14, 7}, Security: true,
        Packages: []string{"encoding/binary"},
    },
    {
        Date: Date{2020, 8, 6}, Version: Version{1, 13, 15}, Security: true,
        Packages: []string{"encoding/binary"},
    },
    {
        Date: Date{2020, 7, 16}, Version: Version{1, 14, 6},
        Components: []template.HTML{"the <code>go</code> command", "the compiler", "the linker", "vet"},
        Packages:   []string{"database/sql", "encoding/json", "net/http", "reflect", "testing"},
    },
    {
        Date: Date{2020, 7, 16}, Version: Version{1, 13, 14},
        Components: []template.HTML{"the compiler", "vet"},
        Packages:   []string{"database/sql", "net/http", "reflect"},
    },
    {
        Date: Date{2020, 7, 14}, Version: Version{1, 14, 5}, Security: true,
        Packages: []string{"crypto/x509", "net/http"},
    },
    {
        Date: Date{2020, 7, 14}, Version: Version{1, 13, 13}, Security: true,
        Packages: []string{"crypto/x509", "net/http"},
    },
    {
        Date: Date{2020, 6, 1}, Version: Version{1, 14, 4},
        Components: []template.HTML{"the <code>go</code> <code>doc</code> command", "the runtime"},
        Packages:   []string{"encoding/json", "os"},
    },
    {
        Date: Date{2020, 6, 1}, Version: Version{1, 13, 12},
        Components: []template.HTML{"the runtime"},
        Packages:   []string{"go/types", "math/big"},
    },
    {
        Date: Date{2020, 5, 14}, Version: Version{1, 14, 3},
        Components: []template.HTML{"cgo", "the compiler", "the runtime"},
        Packages:   []string{"go/doc", "math/big"},
    },
    {
        Date: Date{2020, 5, 14}, Version: Version{1, 13, 11},
        Components: []template.HTML{"the compiler"},
    },
    {
        Date: Date{2020, 4, 8}, Version: Version{1, 14, 2},
        Components: []template.HTML{"cgo", "the go command", "the runtime"},
        Packages:   []string{"os/exec", "testing"},
    },
    {
        Date: Date{2020, 4, 8}, Version: Version{1, 13, 10},
        Components: []template.HTML{"the go command", "the runtime"},
        Packages:   []string{"os/exec", "time"},
    },
    {
        Date: Date{2020, 3, 19}, Version: Version{1, 14, 1},
        Components: []template.HTML{"the go command", "tools", "the runtime"},
    },
    {
        Date: Date{2020, 3, 19}, Version: Version{1, 13, 9},
        Components: []template.HTML{"the go command", "tools", "the runtime", "the toolchain"},
        Packages:   []string{"crypto/cypher"},
    },
    {
        Date: Date{2020, 2, 25}, Version: Version{1, 14, 0},
    },
    {
        Date: Date{2020, 2, 12}, Version: Version{1, 13, 8},
        Components: []template.HTML{"the runtime"},
        Packages:   []string{"crypto/x509", "net/http"},
    },
    {
        Date: Date{2020, 2, 12}, Version: Version{1, 12, 17},
        Quantifier: "a",
        Components: []template.HTML{"the runtime"},
    },
    {
        Date: Date{2020, 1, 28}, Version: Version{1, 13, 7}, Security: true,
        Quantifier: "two",
        Packages:   []string{"crypto/x509"},
    },
    {
        Date: Date{2020, 1, 28}, Version: Version{1, 12, 16}, Security: true,
        Quantifier: "two",
        Packages:   []string{"crypto/x509"},
    },
    {
        Date: Date{2020, 1, 9}, Version: Version{1, 13, 6},
        Components: []template.HTML{"the runtime"},
        Packages:   []string{"net/http"},
    },
    {
        Date: Date{2020, 1, 9}, Version: Version{1, 12, 15},
        Components: []template.HTML{"the runtime"},
        Packages:   []string{"net/http"},
    },
    {
        Date: Date{2019, 12, 4}, Version: Version{1, 13, 5},
        Components: []template.HTML{"the go command", "the runtime", "the linker"},
        Packages:   []string{"net/http"},
    },
    {
        Date: Date{2019, 12, 4}, Version: Version{1, 12, 14},
        Quantifier: "a",
        Components: []template.HTML{"the runtime"},
    },
    {
        Date: Date{2019, 10, 31}, Version: Version{1, 13, 4},
        Packages: []string{"net/http", "syscall"},
        More: `It also fixes an issue on macOS 10.15 Catalina
where the non-notarized installer and binaries were being
<a href="/issue/34986">rejected by Gatekeeper</a>.`,
    },
    {
        Date: Date{2019, 10, 31}, Version: Version{1, 12, 13},
        CustomSummary: `fixes an issue on macOS 10.15 Catalina
where the non-notarized installer and binaries were being
<a href="/issue/34986">rejected by Gatekeeper</a>.
Only macOS users who hit this issue need to update.`,
    },
    {
        Date: Date{2019, 10, 17}, Version: Version{1, 13, 3},
        Components: []template.HTML{"the go command", "the toolchain", "the runtime"},
        Packages:   []string{"syscall", "net", "net/http", "crypto/ecdsa"},
    },
    {
        Date: Date{2019, 10, 17}, Version: Version{1, 12, 12},
        Components: []template.HTML{"the go command", "runtime"},
        Packages:   []string{"syscall", "net"},
    },
    {
        Date: Date{2019, 10, 17}, Version: Version{1, 13, 2}, Security: true,
        Components: []template.HTML{"the compiler"},
        Packages:   []string{"crypto/dsa"},
    },
    {
        Date: Date{2019, 10, 17}, Version: Version{1, 12, 11}, Security: true,
        Packages: []string{"crypto/dsa"},
    },
    {
        Date: Date{2019, 9, 25}, Version: Version{1, 13, 1}, Security: true,
        Packages: []string{"net/http", "net/textproto"},
    },
    {
        Date: Date{2019, 9, 25}, Version: Version{1, 12, 10}, Security: true,
        Packages: []string{"net/http", "net/textproto"},
    },
    {
        Date: Date{2019, 9, 3}, Version: Version{1, 13, 0},
    },
    {
        Date: Date{2019, 8, 15}, Version: Version{1, 12, 9},
        Components: []template.HTML{"the linker"},
        Packages:   []string{"os", "math/big"},
    },
    {
        Date: Date{2019, 8, 13}, Version: Version{1, 12, 8}, Security: true,
        Packages: []string{"net/http", "net/url"},
    },
    {
        Date: Date{2019, 8, 13}, Version: Version{1, 11, 13}, Security: true,
        Packages: []string{"net/http", "net/url"},
    },
    {
        Date: Date{2019, 7, 8}, Version: Version{1, 12, 7},
        Components: []template.HTML{"cgo", "the compiler", "the linker"},
    },
    {
        Date: Date{2019, 7, 8}, Version: Version{1, 11, 12},
        Components: []template.HTML{"the compiler", "the linker"},
    },
    {
        Date: Date{2019, 6, 11}, Version: Version{1, 12, 6},
        Components: []template.HTML{"the compiler", "the linker", "the go command"},
        Packages:   []string{"crypto/x509", "net/http", "os"},
    },
    {
        Date: Date{2019, 6, 11}, Version: Version{1, 11, 11},
        Quantifier: "a",
        Packages:   []string{"crypto/x509"},
    },
    {
        Date: Date{2019, 5, 6}, Version: Version{1, 12, 5},
        Components: []template.HTML{"the compiler", "the linker", "the go command", "the runtime"},
        Packages:   []string{"os"},
    },
    {
        Date: Date{2019, 5, 6}, Version: Version{1, 11, 10},
        Components: []template.HTML{"the runtime", "the linker"},
    },
    {
        Date: Date{2019, 4, 11}, Version: Version{1, 12, 4},
        CustomSummary: `fixes an issue where using the prebuilt binary
releases on older versions of GNU/Linux
<a href="/issues/31293">led to failures</a>
when linking programs that used cgo.
Only Linux users who hit this issue need to update.`,
    },
    {
        Date: Date{2019, 4, 11}, Version: Version{1, 11, 9},
        CustomSummary: `fixes an issue where using the prebuilt binary
releases on older versions of GNU/Linux
<a href="/issues/31293">led to failures</a>
when linking programs that used cgo.
Only Linux users who hit this issue need to update.`,
    },
    {
        Date: Date{2019, 4, 8}, Version: Version{1, 12, 3},
        CustomSummary: `was accidentally released without its
intended fix. It is identical to go1.12.2, except for its version
number. The intended fix is in go1.12.4.`,
    },
    {
        Date: Date{2019, 4, 8}, Version: Version{1, 11, 8},
        CustomSummary: `was accidentally released without its
intended fix. It is identical to go1.11.7, except for its version
number. The intended fix is in go1.11.9.`,
    },
    {
        Date: Date{2019, 4, 5}, Version: Version{1, 12, 2},
        Components: []template.HTML{"the compiler", "the go command", "the runtime"},
        Packages:   []string{"doc", "net", "net/http/httputil", "os"},
    },
    {
        Date: Date{2019, 4, 5}, Version: Version{1, 11, 7},
        Components: []template.HTML{"the runtime"},
        Packages:   []string{"net"},
    },
    {
        Date: Date{2019, 3, 14}, Version: Version{1, 12, 1},
        Components: []template.HTML{"cgo", "the compiler", "the go command"},
        Packages:   []string{"fmt", "net/smtp", "os", "path/filepath", "sync", "text/template"},
    },
    {
        Date: Date{2019, 3, 14}, Version: Version{1, 11, 6},
        Components: []template.HTML{"cgo", "the compiler", "linker", "runtime", "go command"},
        Packages:   []string{"crypto/x509", "encoding/json", "net", "net/url"},
    },
    {
        Date: Date{2019, 2, 25}, Version: Version{1, 12, 0},
    },
    {
        Date: Date{2019, 1, 23}, Version: Version{1, 11, 5}, Security: true,
        Quantifier: "a",
        Packages:   []string{"crypto/elliptic"},
    },
    {
        Date: Date{2019, 1, 23}, Version: Version{1, 10, 8}, Security: true,
        Quantifier: "a",
        Packages:   []string{"crypto/elliptic"},
    },
    {
        Date: Date{2018, 12, 14}, Version: Version{1, 11, 4},
        Components: []template.HTML{"cgo", "the compiler", "linker", "runtime", "documentation", "go command"},
        Packages:   []string{"net/http", "go/types"},
        More: `It includes a fix to a bug introduced in Go 1.11.3 that broke <code>go</code>
<code>get</code> for import path patterns containing "<code>...</code>".`,
    },
    {
        Date: Date{2018, 12, 14}, Version: Version{1, 10, 7},
        // TODO: Modify to follow usual pattern, say it includes a fix to the go command.
        CustomSummary: `includes a fix to a bug introduced in Go 1.10.6
that broke <code>go</code> <code>get</code> for import path patterns containing
"<code>...</code>".
See the <a href="https://github.com/golang/go/issues?q=milestone%3AGo1.10.7+label%3ACherryPickApproved">
Go 1.10.7 milestone</a> on our issue tracker for details.`,
    },
    {
        Date: Date{2018, 12, 12}, Version: Version{1, 11, 3}, Security: true,
        Quantifier: "three",
        Components: []template.HTML{`"go get"`},
        Packages:   []string{"crypto/x509"},
    },
    {
        Date: Date{2018, 12, 12}, Version: Version{1, 10, 6}, Security: true,
        Quantifier: "three",
        Components: []template.HTML{`"go get"`},
        Packages:   []string{"crypto/x509"},
        More:       "It contains the same fixes as Go 1.11.3 and was released at the same time.",
    },
    {
        Date: Date{2018, 11, 2}, Version: Version{1, 11, 2},
        Components: []template.HTML{"the compiler", "linker", "documentation", "go command"},
        Packages:   []string{"database/sql", "go/types"},
    },
    {
        Date: Date{2018, 11, 2}, Version: Version{1, 10, 5},
        Components: []template.HTML{"the go command", "linker", "runtime"},
        Packages:   []string{"database/sql"},
    },
    {
        Date: Date{2018, 10, 1}, Version: Version{1, 11, 1},
        Components: []template.HTML{"the compiler", "documentation", "go command", "runtime"},
        Packages:   []string{"crypto/x509", "encoding/json", "go/types", "net", "net/http", "reflect"},
    },
    {
        Date: Date{2018, 8, 24}, Version: Version{1, 11, 0},
    },
    {
        Date: Date{2018, 8, 24}, Version: Version{1, 10, 4},
        Components: []template.HTML{"the go command", "linker"},
        Packages:   []string{"net/http", "mime/multipart", "ld/macho", "bytes", "strings"},
    },
    {
        Date: Date{2018, 6, 5}, Version: Version{1, 10, 3},
        Components: []template.HTML{"the go command"},
        Packages:   []string{"crypto/tls", "crypto/x509", "strings"},
        More: `In particular, it adds <a href="https://go.googlesource.com/go/+/d4e21288e444d3ffd30d1a0737f15ea3fc3b8ad9">
minimal support to the go command for the vgo transition</a>.`,
    },
    {
        Date: Date{2018, 6, 5}, Version: Version{1, 9, 7},
        Components: []template.HTML{"the go command"},
        Packages:   []string{"crypto/x509", "strings"},
        More: `In particular, it adds <a href="https://go.googlesource.com/go/+/d4e21288e444d3ffd30d1a0737f15ea3fc3b8ad9">
minimal support to the go command for the vgo transition</a>.`,
    },
    {
        Date: Date{2018, 5, 1}, Version: Version{1, 10, 2},
        Components: []template.HTML{"the compiler", "linker", "go command"},
    },
    {
        Date: Date{2018, 5, 1}, Version: Version{1, 9, 6},
        Components: []template.HTML{"the compiler", "go command"},
    },
    {
        Date: Date{2018, 3, 28}, Version: Version{1, 10, 1},
        Components: []template.HTML{"the compiler", "runtime"},
        Packages:   []string{"archive/zip", "crypto/tls", "crypto/x509", "encoding/json", "net", "net/http", "net/http/pprof"},
    },
    {
        Date: Date{2018, 3, 28}, Version: Version{1, 9, 5},
        Components: []template.HTML{"the compiler", "go command"},
        Packages:   []string{"net/http/pprof"},
    },
    {
        Date: Date{2018, 2, 16}, Version: Version{1, 10, 0},
    },
    {
        Date: Date{2018, 2, 7}, Version: Version{1, 9, 4}, Security: true,
        Quantifier: "a",
        Components: []template.HTML{`"go get"`},
    },
    {
        Date: Date{2018, 1, 22}, Version: Version{1, 9, 3},
        Components: []template.HTML{"the compiler", "runtime"},
        Packages:   []string{"database/sql", "math/big", "net/http", "net/url"},
    },
    {
        Date: Date{2017, 10, 25}, Version: Version{1, 9, 2},
        Components: []template.HTML{"the compiler", "linker", "runtime", "documentation", "<code>go</code> command"},
        Packages:   []string{"crypto/x509", "database/sql", "log", "net/smtp"},
        More: `It includes a fix to a bug introduced in Go 1.9.1 that broke <code>go</code> <code>get</code>
of non-Git repositories under certain conditions.`,
    },
    {
        Date: Date{2017, 10, 4}, Version: Version{1, 9, 1}, Security: true,
        Quantifier: "two",
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
        Date: Date{2016, 8, 15}, Version: Version{1, 7, 0},
    },
    {
        Date: Date{2016, 2, 17}, Version: Version{1, 6, 0},
    },
    {
        Date: Date{2015, 8, 19}, Version: Version{1, 5, 0},
    },
    {
        Date: Date{2014, 12, 10}, Version: Version{1, 4, 0},
    },
    {
        Date: Date{2014, 6, 18}, Version: Version{1, 3, 0},
    },
    {
        Date: Date{2013, 12, 1}, Version: Version{1, 2, 0},
    },
    {
        Date: Date{2013, 5, 13}, Version: Version{1, 1, 0},
    },
    {
        Date: Date{2012, 3, 28}, Version: Version{1, 0, 0},
    },
}