"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { minify: minifyJs } = require("terser");
const { minify: minifyHtml } = require("html-minifier-terser");
const CleanCSS = require("clean-css");

const DIST = path.join(__dirname, "dist");
const GAME_DIR = path.join(__dirname, "game");
const PAGES = ["game"]; // add more page basenames (page.html/css/js in game/) here as they're ready

async function build() {
  // roadroller's CommonJS entry point (index.cjs) goes through the "esm"
  // package, which is broken under current Node; the ESM entry point
  // (index.mjs) doesn't have that dependency, so load it via dynamic import.
  const { Packer } = await import("roadroller");

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST);

  for (const name of PAGES) {
    const htmlPath = path.join(GAME_DIR, `${name}.html`);
    const cssPath = path.join(GAME_DIR, `${name}.css`);

    const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf8") : "";
    let html = fs.readFileSync(htmlPath, "utf8");

    // Collect every local <script src="*.js"> tag, in document order, and
    // concatenate their sources. This lets a page split its JS across
    // several files (e.g. gl-utils.js, track.js, unicorn-rig.js, game.js)
    // for readability while still shipping as one inlined+minified script.
    const scriptTagRe = /<script[^>]*src=["']([^"']+\.js)["'][^>]*><\/script>/g;
    const scriptTags = [...html.matchAll(scriptTagRe)];
    const js = scriptTags
      .map((match) => fs.readFileSync(path.join(GAME_DIR, match[1]), "utf8"))
      .join("\n");

    let minJs = "";
    if (js) {
      const result = await minifyJs(js, { toplevel: true, compress: true, mangle: true });
      minJs = result.code;

      // Roadroller's context-mixing compressor beats what ZIP's DEFLATE can
      // do on already-minified JS (particularly the repetitive number
      // arrays in the horse mesh data), at the cost of a small inline
      // decoder. Worth it right at the js13k size limit.
      const packer = new Packer([{ data: minJs, type: "js", action: "eval" }]);
      await packer.optimize();
      const { firstLine, secondLine } = packer.makeDecoder();
      minJs = firstLine + secondLine;
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
      let inlined = false;
      html = html.replace(scriptTagRe, () => {
        if (inlined) return "";
        inlined = true;
        return `<script>${minJs}</script>`;
      });
    }

    html = await minifyHtml(html, {
      collapseWhitespace: true,
      removeComments: true,
      minifyCSS: true,
      // minifyJS is off: the inlined script is already Roadroller output
      // (control characters + a packed string), and re-running Terser/
      // html-minifier-terser's JS minifier on that would corrupt it.
      minifyJS: false,
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

  // Compress-Archive's deflate is far from optimal; advzip (AdvanceCOMP,
  // zopfli-based) recompresses the same entries losslessly and reliably
  // shaves several hundred bytes off, which matters right at the js13k
  // limit. Optional: skipped if the binary isn't present on this machine.
  const advzipPath = path.join(__dirname, "tools", "advancecomp", "advzip.exe");
  if (fs.existsSync(advzipPath)) {
    execSync(`"${advzipPath}" -z -4 -i 200 -q "${zipPath}"`, { cwd: __dirname, stdio: "inherit" });
  }

  const zipSize = fs.statSync(zipPath).size;
  const limit = 13312; // js13kgames limit (13 KB)
  console.log(`\ndist.zip: ${zipSize} bytes / ${limit} bytes (${((zipSize / limit) * 100).toFixed(1)}%)`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
