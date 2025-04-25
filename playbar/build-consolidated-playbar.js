const fs = require("fs");
const path = require("path");

// File paths
const baseDir = __dirname;
const htmlPath = path.join(baseDir, "index.html");
const cssPath = path.join(baseDir, "styles.css");
const jsPath = path.join(baseDir, "visualizer.js");
const outputHtml = path.join(baseDir, "consolidated.html");
const outputIframe = path.join(baseDir, "squarespaceLoader.html");

// Load file contents
const html = fs.readFileSync(htmlPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const js = fs.readFileSync(jsPath, "utf8");

// Combine into one HTML file
const consolidated = `
${html}

<style>
${css}
</style>

<script>
${js}
</script>
`;

// Write to consolidated.html
fs.writeFileSync(outputHtml, consolidated);
console.log("✅ consolidated.html created successfully.");

// Generate squarespaceLoader.html with cache-busting version
const version = Date.now(); // timestamp-based cache buster
const iframeCode = `
<iframe 
  src="https://alex-fortunato.github.io/Website/playbar/consolidated.html?v=${version}"
  width="100%" 
  height="180"
  style="border: none; overflow: hidden;">
</iframe>
`;

fs.writeFileSync(outputIframe, iframeCode.trim());
console.log("✅ squarespaceLoader.html created with version:", version);
