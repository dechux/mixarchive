import fs from "fs";
import path from "path";

export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const raw = fs.readFileSync(filePath, "utf-8");

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON: ${filePath} / ${error.message}`);
  }
}

export function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  ensureDir(dir);

  const tempPath = `${filePath}.tmp`;
  const json = JSON.stringify(data, null, 2);

  fs.writeFileSync(tempPath, json, "utf-8");
  JSON.parse(fs.readFileSync(tempPath, "utf-8"));

  fs.renameSync(tempPath, filePath);
}

export function backupFile(filePath, backupDir = "data/backups") {
  if (!fs.existsSync(filePath)) return null;

  ensureDir(backupDir);

  const fileName = path.basename(filePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `${timestamp}_${fileName}`);

  fs.copyFileSync(filePath, backupPath);

  return backupPath;
}