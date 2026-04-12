/**
 * Babel configuration for Sanctuary.
 *
 * Uses babel-preset-expo (which wraps @react-native/babel-preset) as the
 * base configuration for Metro and tests.
 *
 * In the `test` environment (NODE_ENV=test, i.e. when running Jest), we add
 * a small inline plugin that transforms dynamic `import(x)` expressions to
 * `Promise.resolve().then(() => require(x))`. This is necessary because
 * babel-preset-expo targets Metro, which handles `import()` natively, but
 * Jest's CJS runner cannot execute native `import()` without
 * --experimental-vm-modules.
 *
 * The transformation is semantically equivalent for the use-case in this
 * codebase (lazy-loading expo-notifications) and allows `jest.mock()` to
 * intercept the require() call as usual.
 */

module.exports = function (api) {
  api.cache(true);

  /**
   * Transform `import(source)` → `Promise.resolve().then(() => require(source))`
   * for Jest's CJS module runner.
   *
   * In @react-native/babel-preset's Babel AST, `import("x")` is represented
   * as a `CallExpression` with `callee.type === "Import"` (not `ImportExpression`).
   * We match on that shape so `jest.mock()` can intercept the resulting require().
   */
  function dynamicImportToRequire({ types: t }) {
    return {
      name: "@babel/plugin-proposal-dynamic-import",
      visitor: {
        CallExpression(path) {
          if (!t.isImport(path.node.callee)) return;
          const source = path.node.arguments[0];
          if (!source) return;
          path.replaceWith(
            t.callExpression(
              t.memberExpression(
                t.callExpression(
                  t.memberExpression(
                    t.identifier("Promise"),
                    t.identifier("resolve"),
                  ),
                  [],
                ),
                t.identifier("then"),
              ),
              [
                t.arrowFunctionExpression(
                  [],
                  t.callExpression(t.identifier("require"), [source]),
                ),
              ],
            ),
          );
        },
      },
    };
  }

  return {
    presets: ["babel-preset-expo"],
    env: {
      test: {
        plugins: [dynamicImportToRequire],
      },
    },
  };
};
