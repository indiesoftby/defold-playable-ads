const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const htmlmin = require("gulp-html-minifier-terser");
const Vinyl = require("vinyl");

const root = path.join(__dirname, "..");
const template = fs.readFileSync(path.join(root, "manifests/web/engine_template.html"), "utf8");
const start = template.indexOf("      function getMraidApi() {");
const end = template.indexOf("      // mraid Support", start);
assert.ok(start >= 0 && end > start, "CTA integration must be present in the template");
const source = template.slice(start, end)
  .replace("{{playable_ad.app_store_url}}", "https://example.com/ios")
  .replace("{{playable_ad.google_play_url}}", "https://example.com/android");

// Use the actual packaging options so a minifier change exercises this regression.
const gulpSource = fs.readFileSync(path.join(root, "gulpfile.js"), "utf8");
const options = [...gulpSource.matchAll(/htmlmin\((\{[\s\S]*?\})\s*\)/g)];
assert.equal(options.length, 1, "Expected one HTML minification configuration");
const minifierOptions = vm.runInNewContext("(" + options[0][1] + ")");

function minify(source) {
  return new Promise((resolve, reject) => {
    const stream = htmlmin(minifierOptions);
    stream.on("error", reject);
    stream.on("data", (file) => {
      const script = file.contents.toString().match(/<script[^>]*>([\s\S]*?)<\/script>/);
      if (script) resolve(script[1]);
      else reject(new Error("Minified CTA script is missing"));
    });
    stream.end(new Vinyl({path: "index.html", contents: Buffer.from("<script>" + source + "</script>")}));
  });
}

function install(source, {binding, userAgent = "Android", network} = {}) {
  const calls = [];
  const window = {
    navigator: {userAgent},
    open: (url, target) => calls.push(["browser", url, target])
  };
  const context = vm.createContext({window, console});
  const mraidApi = {open: (url) => calls.push(["mraid", url])};
  if (binding === "global") {
    window.mraid = context.mraid = mraidApi;
  } else if (binding === "lexical") {
    context.injectedMraid = mraidApi;
    vm.runInContext("const mraid = injectedMraid;", context);
    delete context.injectedMraid;
  } else if (binding === "window") {
    window.mraid = mraidApi;
  }
  if (network === "facebook") {
    window.FbPlayableAd = context.FbPlayableAd = {onCTAClick: () => calls.push(["facebook"])};
  } else if (network === "mintegral") {
    window.install = () => calls.push(["mintegral"]);
  } else if (network === "admob") {
    window.ExitApi = context.ExitApi = {exit: () => calls.push(["admob"])};
  }
  vm.runInContext(source, context);
  window.Playable.install();
  return calls;
}

function checkRouting(source) {
  for (const binding of ["global", "lexical", "window"]) {
    for (const [userAgent, platform] of [["Android", "android"], ["iPhone", "ios"]]) {
      assert.deepEqual(install(source, {binding, userAgent}), [["mraid", "https://example.com/" + platform]],
        binding + " MRAID must receive the " + platform + " destination");
    }
  }
  for (const network of ["facebook", "mintegral", "admob"]) {
    assert.deepEqual(install(source, {network}), [[network]]);
  }
  assert.deepEqual(install(source, {binding: "global", network: "facebook"}), [["facebook"]]);
  assert.deepEqual(install(source, {binding: "global", network: "mintegral"}), [["mintegral"]]);
  assert.deepEqual(install(source, {binding: "global", network: "admob"}), [["mraid", "https://example.com/android"]]);
  assert.deepEqual(install(source), [["browser", "https://example.com/android", "_blank"]]);
}

test("template CTA preserves SDK routing and MRAID bindings", () => {
  checkRouting(source);
});

test("packaging preserves a direct mraid.open call and working CTA routes", async () => {
  const minified = await minify(source);
  assert.match(minified, /\bmraid\s*\.\s*open\s*\(/,
    "Ad upload validators must be able to find mraid.open in minified HTML");
  checkRouting(minified);
});
