import { defineConfig } from "prisma/config";
import { loadEnvForTarget } from "./scripts/db-utils";

loadEnvForTarget(process.env.NODE_ENV === "production" ? "production" : "development");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "file:../maison-olive-data/db/dev.db",
  },
});
