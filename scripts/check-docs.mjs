import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

async function markdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await markdownFiles(path)));
    else if (entry.name.endsWith(".md")) files.push(path);
  }
  return files;
}

const root = resolve(import.meta.dirname, "..");
const missing = [];
for (const file of await markdownFiles(root)) {
  const markdown = await readFile(file, "utf8");
  for (const match of markdown.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split("#")[0];
    if (
      !target ||
      target.startsWith("http://") ||
      target.startsWith("https://") ||
      target.startsWith("mailto:")
    ) {
      continue;
    }
    const path = resolve(dirname(file), target);
    try {
      await stat(path);
    } catch {
      missing.push(`${file.slice(root.length + 1)} -> ${target}`);
    }
  }
}

if (missing.length) {
  console.error(`Missing local documentation targets:\n${missing.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log("Documentation links and images resolve.");
}
