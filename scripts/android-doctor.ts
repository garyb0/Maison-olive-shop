import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const requiredFiles = [
  "capacitor.config.ts",
  "capacitor-www/index.html",
  "android/app/src/main/AndroidManifest.xml",
];

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

function findAndroidSdk() {
  const configured = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  if (configured && existsSync(path.join(configured, "platforms"))) return configured;

  const localAppData = process.env.LOCALAPPDATA;
  const candidate = localAppData ? path.join(localAppData, "Android", "Sdk") : "";
  return candidate && existsSync(path.join(candidate, "platforms")) ? candidate : null;
}

type Check = {
  label: string;
  ok: boolean;
  detail?: string;
};

async function main() {
  const javaHome = findJavaHome();
  const androidSdk = findAndroidSdk();
  const javaCheck = javaHome
    ? spawnSync(path.join(javaHome, "bin", "java.exe"), ["-version"])
    : spawnSync("java", ["-version"]);
  const checks: Check[] = requiredFiles.map((relativePath) => ({
    label: relativePath,
    ok: existsSync(path.join(root, relativePath)),
  }));

  const capacitorConfig = await readFile(path.join(root, "capacitor.config.ts"), "utf8").catch(() => "");
  checks.push({
    label: "appId ca.chezolive.app",
    ok: capacitorConfig.includes('appId: "ca.chezolive.app"'),
  });
  checks.push({
    label: "production app start /app",
    ok: capacitorConfig.includes('appStartPath: "/app"'),
  });
  checks.push({
    label: "offline fallback page",
    ok: existsSync(path.join(root, "capacitor-www/offline.html")) && capacitorConfig.includes('errorPath: "offline.html"'),
  });
  checks.push({
    label: "splash auto-hide fallback",
    ok: capacitorConfig.includes("launchAutoHide: true"),
  });
  checks.push({
    label: "Firebase google-services.json",
    ok: existsSync(path.join(root, "android/app/google-services.json")),
    detail: "Required before a real Play/Firebase push build.",
  });
  checks.push({
    label: "Android signing key.properties",
    ok: existsSync(path.join(root, "android/key.properties")),
    detail: "Required before a signed Play release bundle.",
  });
  checks.push({
    label: "Java runtime for Gradle",
    ok: javaCheck.status === 0,
    detail: "Required for npm run android:build and npm run android:bundle.",
  });
  checks.push({
    label: "Android SDK",
    ok: Boolean(androidSdk) || existsSync(path.join(root, "android/local.properties")),
    detail: "Required for Gradle Android builds.",
  });

  console.log("Android readiness");
  for (const check of checks) {
    const marker = check.ok ? "OK" : "MISSING";
    console.log(`- ${marker}: ${check.label}${check.detail ? ` (${check.detail})` : ""}`);
  }

  const blockingFailures = checks.filter(
    (check) =>
      !check.ok &&
      check.label !== "Firebase google-services.json" &&
      check.label !== "Android signing key.properties" &&
      check.label !== "Java runtime for Gradle" &&
      check.label !== "Android SDK",
  );
  if (blockingFailures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
