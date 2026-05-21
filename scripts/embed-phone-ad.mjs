#!/usr/bin/env node
// Inlines the brand-ad-phone.html standalone bundle into preview.html
// as an iframe srcdoc for slide 3's phone mockup.
//
// Why a script: preview.html is ~2MB and the phone bundle is ~2.7MB; doing
// the srcdoc escape + replace in one shot is more reliable than hand-edits.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const previewPath = resolve(root, "templates/product-demo/preview.html");
const phonePath = resolve(root, "templates/product-demo/assets/brand-ad-phone.html");

const preview = readFileSync(previewPath, "utf8");
const phone = readFileSync(phonePath, "utf8");

// Strip the standalone's gradient body bg + padding so it sits cleanly inside
// the slide. We inject a tiny override into the phone bundle's <head> by
// replacing its body { ... } rule.
const phonePatched = phone.replace(
  /html,\s*body\s*\{[^}]*\}/,
  `html, body { margin: 0; padding: 0; min-height: 100vh; background: transparent; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111; -webkit-font-smoothing: antialiased; }`
).replace(
  /#root\s*\{[^}]*\}/,
  `#root { min-height: 100vh; display: grid; place-items: center; padding: 0; box-sizing: border-box; }`
);

// HTML attribute-value escaping for srcdoc.
// Inside a double-quoted attribute: escape & and ".
function escapeSrcdoc(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
const srcdoc = escapeSrcdoc(phonePatched);

// Existing phone block to replace (starts at the marker comment, ends at the
// closing </div> of the outer .mockup container — two divs deep).
const start = preview.indexOf("<!-- PHONE / FACEBOOK AD — center -->");
if (start < 0) {
  console.error("Could not find phone block start marker in preview.html");
  process.exit(1);
}
// Find the outer .mockup div opening
const divOpen = preview.indexOf("<div class=\"mockup\"", start);
// Walk forward counting <div> / </div> until balance hits 0
let depth = 0;
let i = divOpen;
let end = -1;
while (i < preview.length) {
  const nextOpen = preview.indexOf("<div", i);
  const nextClose = preview.indexOf("</div>", i);
  if (nextClose < 0) break;
  if (nextOpen >= 0 && nextOpen < nextClose) {
    depth++;
    i = nextOpen + 4;
  } else {
    depth--;
    i = nextClose + 6;
    if (depth === 0) { end = i; break; }
  }
}
if (end < 0) {
  console.error("Could not find phone block end div");
  process.exit(1);
}

const replacement = `<!-- PHONE / FACEBOOK AD — center
             Embeds brand-ad-phone.html bundle as iframe srcdoc so the
             ad renders fully inside the phone bezel. Brand fields
             (price, tagline, CTA, domain) live in the bundle's
             EDITMODE-BEGIN/EDITMODE-END block and are rewritten per
             brand by the AI generator at generate-time. -->
        <div class="mockup mockup-phone" style="left:39%; top:14%; width:14%; height:78%;">
          <iframe class="phone-frame" srcdoc="${srcdoc}" title="Brand Facebook ad — phone mockup" scrolling="no"></iframe>
        </div>`;

const out = preview.slice(0, start) + replacement + preview.slice(end);
writeFileSync(previewPath, out, "utf8");
console.log(`Replaced phone block: ${end - start} bytes -> ${replacement.length} bytes`);
console.log(`Preview size: ${out.length} bytes`);
