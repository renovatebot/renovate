Anything other than `.exact(<...>)` will be treated as range with respect to Swift specific.
Because of this, some PR descriptions will look like `from: <...> => <...>`.

Examples:

```swift
package(name: "<...>", from: "1.2.3")     // => from: "2.0.0"
package(name: "<...>", "1.2.3"...)        // => "2.0.0"...
package(name: "<...>", "1.2.3"..."1.3.0") // => "1.2.3"..."2.0.0"
package(name: "<...>", "1.2.3"..<"1.3.0") // => "1.2.3"..<"2.0.0"
package(name: "<...>", ..."1.2.3")        // => ..."2.0.0"
package(name: "<...>", ..<"1.2.3")        // => ..<"2.0.0"
```
