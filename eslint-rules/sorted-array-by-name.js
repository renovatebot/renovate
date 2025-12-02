module.exports = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description:
        'Ensure objects inside arrays are sorted alphabetically by name key.',
    },
    schema: [],
    messages: {
      notSorted:
        "Objects in this array are not sorted by 'name'. '{{current}}' should come before '{{previous}}'.",
    },
  },

  /**
   * @param {any} context
   */
  create(context) {
    /**
     * @param {any} node
     */
    function checkArraySort(node) {
      // Only arrays of object literals
      if (
        !node.elements.every(
          (/** @type {any} */ el) => el?.type === 'ObjectExpression',
        )
      ) {
        return;
      }

      // Extract objects + names
      const items = node.elements.map((/** @type {any} */ el) => {
        const nameProp = el.properties.find(
          (/** @type {any} */ p) =>
            p.type === 'Property' &&
            !p.computed &&
            p.key.type === 'Identifier' &&
            p.key.name === 'name',
        );

        if (nameProp?.value.type !== 'Literal') {
          return null;
        }
        return { name: nameProp.value.value, node: el };
      });

      // Skip if any object has no literal `name`
      if (items.some((/** @type {any} */ x) => x === null)) {
        return;
      }

      const names = items.map((/** @type {any} */ i) => i.name);
      const sortedNames = [...names].sort((a, b) =>
        String(a).localeCompare(String(b)),
      );

      // If already sorted → do nothing
      if (JSON.stringify(names) === JSON.stringify(sortedNames)) {
        return;
      }

      // Report the FIRST out-of-order element
      for (let i = 1; i < names.length; i++) {
        if (names[i - 1].localeCompare(names[i]) > 0) {
          const curr = names[i];
          const prev = names[i - 1];

          context.report({
            node: items[i].node,
            messageId: 'notSorted',
            data: { current: curr, previous: prev },

            /**
             * @param {any} fixer
             */
            fix(fixer) {
              // Sort the entire array's elements (as text)
              const sourceCode = context.getSourceCode();

              const sortedElements = [...node.elements].sort((a, b) => {
                const aName = items.find(
                  (/** @type {any} */ it) => it.node === a,
                )?.name;
                const bName = items.find(
                  (/** @type {any} */ it) => it.node === b,
                )?.name;
                return String(aName).localeCompare(String(bName));
              });

              const newText = `[${sortedElements
                .map((el) => sourceCode.getText(el))
                .join(', ')}]`;

              return fixer.replaceText(node, newText);
            },
          });

          break;
        }
      }
    }

    return {
      ArrayExpression: checkArraySort,
    };
  },
};
