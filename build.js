"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { minify: minifyJs } = require("terser");
const { minify: minifyHtml } = require("html-minifier-terser");
const CleanCSS = require("clean-css");

const DIST = path.join(__dirname, "dist");
const PAGES = ["human", "unicorn", "game"]; // add more page basenames (page.html/css/js) here as they're ready

async function build() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST);

  for (const name of PAGES) {
    const htmlPath = path.join(__dirname, `${name}.html`);
    const cssPath = path.join(__dirname, `${name}.css`);
    const jsPath = path.join(__dirname, `${name}.js`);

    const js = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, "utf8") : "";
    const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf8") : "";
    let html = fs.readFileSync(htmlPath, "utf8");

    let minJs = "";
    if (js) {
      const result = await minifyJs(js, { toplevel: true, compress: true, mangle: true });
      minJs = result.code;
    }

    let minCss = "";
    if (css) {
      minCss = new CleanCSS({ level: 2 }).minify(css).styles;
    }

    // Inline the css/js into the html and drop the <link>/<script src> tags,
    // so the shipped file is a single self-contained document.
    if (minCss) {
      html = html.replace(
        /<link[^>]*href=["'][^"']*\.css["'][^>]*>/,
        `<style>${minCss}</style>`
      );
    }
    if (minJs) {
      html = html.replace(
        /<script[^>]*src=["'][^"']*\.js["'][^>]*><\/script>/,
        `<script>${minJs}</script>`
      );
    }

    html = await minifyHtml(html, {
      collapseWhitespace: true,
      removeComments: true,
      minifyCSS: true,
      minifyJS: true,
    });

    fs.writeFileSync(path.join(DIST, `${name}.html`), html);
    console.log(`${name}.html -> dist/ (${html.length} bytes)`);
  }

  const zipPath = path.join(__dirname, "dist.zip");
  fs.rmSync(zipPath, { force: true });
  const files = fs.readdirSync(DIST).map((f) => `"${f}"`).join(" ");
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path ${files.split(" ").map((f) => `dist/${f}`).join(",")} -DestinationPath dist.zip -CompressionLevel Optimal"`,
    { cwd: __dirname, stdio: "inherit" }
  );

  const zipSize = fs.statSync(zipPath).size;
  const limit = 13312; // js13kgames limit (13 KB)
  console.log(`\ndist.zip: ${zipSize} bytes / ${limit} bytes (${((zipSize / limit) * 100).toFixed(1)}%)`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
