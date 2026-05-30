import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const task = process.argv.slice(2);

function findJavaHome() {
  const configured = process.env.JAVA_HOME;
  if (configured && existsSync(path.join(configured, "bin", "java.exe"))) return configured;

  const candidates = [
    "C:/Program Files/Android/Android Studio/jbr",
    "C:/Program Files/Eclipse Adoptium/jdk-21.0.9.10-hotspot",
    "C:/Program Files/Eclipse Adoptium/jdk-17.0.19.10-hotspot",
  ];

  return candidates.find((candidate) => existsSync(path.join(candidate, "bin", "java.exe"))) ?? null;
}

const javaHome = findJavaHome();
if (!javaHome) {
  console.error("Java/JDK introuvable. Installe JDK 17 ou configure JAVA_HOME.");
  process.exit(1);
}

const gradle = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const result = spawnSync(gradle, task, {
  cwd: path.join(root, "android"),
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    JAVA_HOME: javaHome,
  },
});

process.exit(result.status ?? 1);
