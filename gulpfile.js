const { series, src, dest } = require("gulp");
const chalk = require("chalk");
const crypto = require("crypto");
const download = require("gulp-download-stream");
const fancyLog = require("fancy-log");
const fs = require("fs");
const htmlmin = require("gulp-htmlmin");
const ini = require("ini");
const matchAll = require("string.prototype.matchall");
const prettyBytes = require("pretty-bytes");
const rename = require("gulp-rename");
const replace = require("gulp-replace");
const sevenBin = require("7zip-bin");
const through2 = require("through2");
const { spawn } = require("child_process");
const Vinyl = require("vinyl");

let projectTitle = "playable_ads";

const buildDir = "build";
const archiveDir = "archive";
const bundleJsWebPath = buildDir + "/bundle/js-web";

const bobJarDownloadUrl =
  "https://d.defold.com/archive/11b1e7662dd68172fca551c52cba248eea16a364/bob/bob.jar";
const bobJarVersionHash = crypto
  .createHash("sha256")
  .update(bobJarDownloadUrl)
  .digest("hex")
  .substr(0, 7);

const bobJarDir = buildDir;
const bobJarFilename = "bob_" + bobJarVersionHash + ".jar";
const bobJarPath = bobJarDir + "/" + bobJarFilename;

//
// Helper functions
//

function logFilesize(filename, type, size) {
  fancyLog(
    "* " +
      chalk.cyan(filename) +
      type +
      " size " +
      chalk.magenta(size + " B (" + prettyBytes(size) + ")")
  );
}

function sevenDeflate(filepath, cb) {
  let deflated = Buffer.alloc(0);
  const cmd = spawn(
    sevenBin.path7za,
    ["a", "dummy.gz", "-tgzip", "-mx=9", "-so", filepath],
    { stdio: ["inherit", "pipe", "inherit"] }
  );
  cmd.stdout.on("data", function(data) {
    deflated = Buffer.concat([deflated, data]);
  });
  cmd.on("close", function(code) {
    if (code != 0) {
      throw "Can't deflate the file: " + filepath;
    }
    cb(deflated);
  });
  cmd.on("error", function(err) {
    console.error(err);
  });
}

//
// Gulp tasks
//

function parseProjectConfig(cb) {
  const config = ini.parse(fs.readFileSync("game.project", "utf-8"));
  if (config.project && config.project.title) {
    projectTitle = config.project.title;
  }
  fancyLog("* Project title is '" + chalk.cyan(projectTitle) + "'");
  cb();
}

function javaIsInstalled(cb) {
  var cmd = spawn("java", ["-version"]);
  cmd.on("close", function(code) {
    if (code != 0) {
      throw "Java is not installed";
    }
    cb();
  });
  cmd.on("error", function(err) {
    // skip
  });
}

function downloadBobJar(cb) {
  if (fs.existsSync(bobJarPath)) {
    cb();
  } else {
    return download([
      {
        file: bobJarFilename,
        url: bobJarDownloadUrl
      }
    ]).pipe(dest(bobJarDir));
  }
}

function checkBobJar(cb) {
  const cmd = spawn("java", ["-jar", bobJarPath, "--version"], {
    stdio: "inherit"
  });
  cmd.on("close", function(code) {
    if (code != 0) {
      throw "bob.jar is invalid.";
    }
    cb();
  });
  cmd.on("error", function(err) {
    // skip
  });
}

function buildGame(cb) {
  const cmd = spawn(
    "java",
    [
      "-jar",
      bobJarPath,
      "--bundle-output",
      bundleJsWebPath,
      "--platform",
      "js-web",
      "--archive",
      "resolve",
      // "distclean",
      "build",
      "bundle"
    ],
    { stdio: "inherit" }
  );
  cmd.on("close", function(code) {
    if (code != 0) {
      throw "Can't build the game.";
    }
    cb();
  });
  cmd.on("error", function(err) {
    console.err(err);
  });
}

function combineFilesToBase64(out, pathPrefix) {
  var combinedFiles = {};

  return through2.obj(
    function(file, _, cb) {
      if (file.isNull()) {
        cb(null, file);
        return;
      }

      if (file.isStream()) {
        this.emit("error", new Error("Streaming not supported"));
        return cb();
      }

      var archiveFilename = pathPrefix + file.relative;
      sevenDeflate(file.path, function(deflated) {
        const compressed = Buffer.from(deflated).toString("base64");
        combinedFiles[archiveFilename] = compressed;
        cb();
      });
    },
    function(cb) {
      var prefix = "var embed_archive_data = ";
      var buffer = Buffer.from(
        prefix + JSON.stringify(combinedFiles, null, "  ")
      );
      var fileListFile = new Vinyl({
        path: out,
        contents: buffer
      });
      this.push(fileListFile);
      cb();
    }
  );
}

function copyPakoJs() {
  const dir = bundleJsWebPath + "/" + projectTitle;
  return src("node_modules/pako/dist/pako_inflate.min.js").pipe(dest(dir));
}

function archiveToBase64() {
  const dir = bundleJsWebPath + "/" + projectTitle;
  return src(dir + "/" + archiveDir + "/*")
    .pipe(combineFilesToBase64(projectTitle + "_archive.js", archiveDir + "/"))
    .pipe(dest(dir + "/"));
}

function embedImages(dir) {
  return through2.obj(function(file, _, cb) {
    if (file.isBuffer()) {
      const input = file.contents.toString();
      let output = input;
      let matches = matchAll(
        input,
        /(var splash_image = ")(.+?\.(png|jpg))(")/g
      );
      for (const match of matches) {
        const searchMatch = match[0];
        const filename = match[2];
        const fspath = dir + "/" + filename;

        const imageData = fs.readFileSync(fspath);
        const dataUriData =
          "data:image/" +
          match[3] +
          ";base64," +
          Buffer.from(imageData).toString("base64");
        const replacement = match[1] + dataUriData + match[4];
        output = output.split(searchMatch).join(replacement);

        logFilesize(filename, " encoded", replacement.length);
      }
      file.contents = Buffer.from(output);
    }
    cb(null, file);
  });
}

function embedJs(dir) {
  return through2.obj(function(file, _, cb) {
    if (file.isBuffer()) {
      const input = file.contents.toString();
      let output = input;
      const matches = matchAll(
        input,
        /<script (data-)?src="(.+?)" embed(="(compress)")?><\/script>/g
      );

      const promises = Array.from(matches).map(function(match) {
        return new Promise(function(cb) {
          const searchMatch = match[0];
          const filename = match[2];
          const fspath = dir + "/" + filename;
          const compress = match[4] == "compress";

          if (!compress) {
            const filetext = fs.readFileSync(fspath, "utf-8");
            const replacement = "<script>" + filetext + "\n</script>";
            output = output.split(searchMatch).join(replacement);

            logFilesize(filename, "", replacement.length);

            cb();
          } else {
            sevenDeflate(fspath, function(deflated) {
              const compressed = Buffer.from(deflated).toString("base64");
              const replacement =
                "<script>eval(pako.inflate(atob('" +
                compressed +
                "'), { to: 'string' }));</script>";
              output = output.split(searchMatch).join(replacement);
              logFilesize(filename, " compressed", deflated.length);
              logFilesize(filename, " encoded", replacement.length);
              cb();
            });
          }
        });
      });

      Promise.all(promises).then(function() {
        file.contents = Buffer.from(output);

        cb(null, file);
      });
    } else {
      cb(null, file);
    }
  });
}

function printSize(type) {
  return through2.obj(function(file, _, cb) {
    if (file.isBuffer()) {
      logFilesize(file.relative, type, file.contents.length);
    }
    cb(null, file);
  });
}

function bundlePlayableAds() {
  const dir = bundleJsWebPath + "/" + projectTitle;
  return src(dir + "/index.html")
    .pipe(embedImages(dir))
    .pipe(embedJs(dir))
    .pipe(
      replace(
        // hack for UglifyJS minifier
        /(isWASMSupported)(.|[\r\n])+?}\)\(\),/,
        "$1: false,"
      )
    )
    .pipe(
      replace(
        // custom XMLHttpRequest
        /XMLHttpRequest/g,
        "InternalDataHttpRequest"
      )
    )
    .pipe(rename(projectTitle + ".html"))
    .pipe(
      htmlmin({
        collapseWhitespace: true,
        preserveLineBreaks: true,
        minifyCSS: true,
        minifyJS: true
      })
    )
    .pipe(printSize(" resulting"))
    .pipe(dest(dir));
}

exports.default = series(
  parseProjectConfig,
  javaIsInstalled,
  downloadBobJar,
  checkBobJar,
  buildGame,
  copyPakoJs,
  archiveToBase64,
  bundlePlayableAds
);
