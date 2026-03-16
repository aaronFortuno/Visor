// Run this manually if you need PNG icons:
// node web/scripts/generate-icons.js
// Requires: npm install sharp (run separately, not as a project dep)
console.log("To generate PNG icons, install sharp globally and run:");
console.log("  npx sharp-cli -i web/public/favicon.svg -o web/public/icon-192.png -w 192 -h 192");
console.log("  npx sharp-cli -i web/public/favicon.svg -o web/public/icon-512.png -w 512 -h 512");
console.log("");
console.log("SVG icons work on all modern browsers and are already configured.");
