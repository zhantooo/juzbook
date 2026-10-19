import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Жобада бұрын тест жүйесі болмаған. Vitest тек Arena кодына қосылды:
 * ойын логикасы (ұпай, рейтинг, матч күйі) таза функциялар болғандықтан
 * оларды браузерсіз тексеруге болады.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url))
    }
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "lib/**/*.test.tsx", "app/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/arena/**"],
      reporter: ["text", "html"]
    }
  }
});
