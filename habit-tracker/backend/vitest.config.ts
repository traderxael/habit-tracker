import { defineConfig } from "vitest/config";

// El harness levanta un servidor + un archivo libSQL por fichero de test, y cada
// worker carga el binding nativo de libsql. En paralelo (por defecto) eso agota
// recursos y hace timeouts. Ejecutar en serie y con margen de tiempo amplio.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    fileParallelism: false,
    pool: "forks",
    poolOptions: { forks: { maxForks: 1, minForks: 1 } },
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
