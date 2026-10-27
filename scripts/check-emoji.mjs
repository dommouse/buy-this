import fs from "node:fs";
const t = fs.readFileSync("src/questionnaire/config.ts", "utf8");
const emojis = [...t.matchAll(/emoji:\s*"([^"]+)"/g)].map((m) => m[1]);
const uniq = [...new Set(emojis)];
const dir = fs.readdirSync("src/assets/emoji");
function cp(e) {
  return [...e]
    .map((c) => c.codePointAt(0).toString(16))
    .filter((x) => x !== "fe0f")
    .join("-");
}
const miss = [];
for (const e of uniq) {
  const name = `${cp(e)}.svg`;
  if (!dir.includes(name)) miss.push({ e, name });
}
console.log("total", uniq.length, "missing", miss.length);
for (const m of miss) console.log("MISS", m.e, m.name);
