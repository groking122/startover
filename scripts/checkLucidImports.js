const fs = require("fs");
const path = require("path");

const scanDir = (dir) => {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) {
      const content = fs.readFileSync(fullPath, "utf8");
      if (content.includes("lucid-cardano") && !content.includes("typeof window") && !content.includes("useEffect")) {
        console.log("⚠️  Possibly unsafe Lucid usage in:", fullPath);
      }
    }
  }
};

scanDir(path.join(__dirname, "../src")); 