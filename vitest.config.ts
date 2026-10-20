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
    // Орта айнымалылары Prisma клиенті құрылмай тұрып қойылуы керек
    setupFiles: ["./vitest.setup.ts"],
    // Тест дерекқоры нөлден құрылады — орналастырылған Turso-ға тиіспейміз
    globalSetup: ["./vitest.global-setup.ts"],
    // Дерекқор файлы бір: тесттер бір-біріне кедергі жасамауы үшін кезекпен
    fileParallelism: false,
    testTimeout: 90_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      include: ["lib/arena/**"],
      reporter: ["text", "html"]
    }
  }
});
