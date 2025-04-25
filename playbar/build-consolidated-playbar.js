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
<script>
// Add event listener to handle messages from the iframe 
window.addEventListener("message", function(event) {
    // Check if the message is from our iframe and contains a link to open
    if (event.data && event.data.type === "openLink" && event.data.url) {
        // Open the link in a new tab/window
        window.open(event.data.url, "_blank")
    }
 });
</script>
<iframe 
  src="https://alex-fortunato.github.io/Website/playbar/consolidated.html?v=${version}"
  width="100%" 
  height="160"
  style="border: none; overflow: hidden;">
</iframe>
`;

fs.writeFileSync(outputIframe, iframeCode.trim());
console.log("✅ squarespaceLoader.html created with version:", version);
