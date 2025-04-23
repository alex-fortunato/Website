const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "index.html");
const cssPath = path.join(__dirname, "styles.css");
const jsPath = path.join(__dirname, "script.js");
const outputPath = path.join(__dirname, "consolidated.html");

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
fs.writeFileSync(outputPath, consolidated);

console.log("✅ consolidated.html created successfully.");
