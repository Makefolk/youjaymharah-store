import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../content", import.meta.url));
async function markdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!["public", "generated"].includes(entry.name))
        files.push(...(await markdownFiles(filename)));
    } else if (entry.name.endsWith(".md")) files.push(filename);
  }
  return files;
}
const files = await markdownFiles(root);
const failures = [];
for (const file of files) {
  const source = await readFile(file, "utf8");
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
  if (!/^title: \S/m.test(frontmatter)) {
    failures.push(`${path.relative(root, file)}: missing title frontmatter`);
  }
  if (/\b(?:TODO|TBD|lorem ipsum)\b/i.test(source)) {
    failures.push(`${path.relative(root, file)}: unfinished placeholder`);
  }
  const metadata = source.match(
    /\*\*Audience:\*\*[\s\S]*?\*\*Prerequisites:\*\*/,
  )?.[0];
  if (metadata && !/\n\s*\n/.test(metadata)) {
    failures.push(
      `${path.relative(root, file)}: separate Audience and Prerequisites with a blank line`,
    );
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Checked ${files.length} maintained guides. The production build also checks internal links.`,
  );
