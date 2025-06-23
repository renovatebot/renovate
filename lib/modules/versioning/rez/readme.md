rez versioning was developed to support the [rez Package Manager](https://github.com/nerdvegas/rez).
It's based on Semantic Versioning but includes its own concept of ranges.

**Use of dots**

A range is expressed with dots `1.2..2` means `>=1.2.x <2.0.0`.

**No exact versions unless using two equals ==**

In rez, `1.2.3` doesn't mean "exactly 1.2.3", it actually means `>= 1.2.3 <1.2.4`.
If you want to use an exact version use two equal characters, like this: `==1.2.3`.

**Use of pipes**

rez uses pipes as an OR operator, `2.7..3|4` means `>=2.7 <3 OR 4.x.x`.

This has not been implemented yet.
The current iteration of rez versioning does not support pipes yet.
