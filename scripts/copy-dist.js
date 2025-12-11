import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, "..");
const src = path.join(root, "dist");
const dest = path.join(root, "backend", "dist");

if (!fs.existsSync(src)) {
  console.error("Build output not found:", src);
  process.exit(1);
}

try {
  fs.rmSync(dest, { recursive: true, force: true });

  if (typeof fs.cpSync === "function") {
    fs.cpSync(src, dest, { recursive: true });
  } else {
    const copyRecursive = (s, d) => {
      fs.mkdirSync(d, { recursive: true });
      for (const name of fs.readdirSync(s)) {
        const srcPath = path.join(s, name);
        const dstPath = path.join(d, name);
        if (fs.statSync(srcPath).isDirectory()) copyRecursive(srcPath, dstPath);
        else fs.copyFileSync(srcPath, dstPath);
      }
    };
    copyRecursive(src, dest);
  }

  console.log("Copied", src, "->", dest);
} catch (err) {
  console.error("Failed to copy dist:", err);
  process.exit(1);
}
