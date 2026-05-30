import next from "eslint-config-next";
import prettier from "eslint-config-prettier";

/**
 * ESLint flat config.
 * `eslint-config-next` ships a ready-made flat config array (Next.js 16+).
 * `eslint-config-prettier` is appended last to turn off stylistic rules
 * that would conflict with Prettier formatting.
 */
const eslintConfig = [
  ...next,
  prettier,
  {
    ignores: [".next/**", "node_modules/**"],
  },
];

export default eslintConfig;
