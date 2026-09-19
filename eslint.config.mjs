import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      /*
       * El prefijo `_` marca un parámetro que hay que declarar pero no se
       * usa, y el proyecto ya lo usaba (`_previo` en todas las acciones de
       * servidor). ESLint no lo respetaba por defecto: useActionState
       * obliga a la firma (estadoPrevio, formData) aunque la acción no
       * necesite ninguno de los dos —salir() no necesita ninguno— y eso
       * salía como aviso.
       *
       * Solo afecta a parámetros: una VARIABLE sin usar sigue avisando,
       * que es lo que interesa (un import o un cálculo olvidado sí es
       * basura, un parámetro exigido por una firma no).
       */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
