import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const guideDir = join(root, "guide");
const outFile = join(root, "ui", "episodes.js");

const files = (await readdir(guideDir))
  .filter((name) => name.endsWith(".md"))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const episodes = [];
for (const file of files) {
  const markdown = await readFile(join(guideDir, file), "utf8");
  const title =
    markdown
      .split(/\r?\n/)
      .find((line) => line.startsWith("# "))
      ?.replace(/^#\s+/, "")
      .trim() ?? file;
  const number = file.startsWith("MASTER")
    ? 0
    : Number(file.slice(0, 2)) || 0;
  episodes.push({
    id: file.replace(/\.md$/, ""),
    file,
    number,
    title,
    markdown,
  });
}

episodes.sort((a, b) => a.number - b.number);

await mkdir(join(root, "ui"), { recursive: true });
await writeFile(
  outFile,
  `window.EPISODES = ${JSON.stringify(episodes, null, 2)};\n`,
  "utf8",
);

console.log(`Wrote ${episodes.length} documents to ui/episodes.js`);
