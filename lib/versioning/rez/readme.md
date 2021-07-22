rez versioning was developed to support the [rez Package Manager](https://github.com/nerdvegas/rez). It's based on Semantic versioning but includes its own concept of ranges.

**Use of dots**

A range can be expressed with dots `1.2..2`, it means `>=1.2.x <2.0.0`.

**Use of pipes**

Multiple version requirements can also be separated with a pipe, e.g. `1.2+<1.5|2.2+<3`. We interpret this to mean OR.

**No exact versions unless using two equals ==**

In rez, `1.2.3` doesn't mean "exactly 1.2.3", it actually means `>= 1.2.3 <1.2.4`.
