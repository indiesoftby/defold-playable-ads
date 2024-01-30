//
// Variables
//

let projectTitle = "Unnamed project"; // updated by parseProjectConfig()
let sanitisedTitle = projectTitle;

const playableAdDir = "playable_ad";
const projectDir = "..";
const buildDir = "build";
const archiveDir = "archive";
const bundleJsWebPath = buildDir + "/output_js-web";
const buildSettingsPath = "build.settings";

const bobJarVersionInfoUrl = "https://d.defold.com/stable/info.json";
let bobJarVersionInfo = null; // filled by fetchBobVersionInfo()

const bobJarDir = buildDir;
let bobJarFilename = "bob.jar"; // updated by downloadBobJar()
let bobJarPath = bobJarDir + "/" + bobJarFilename; // updated by downloadBobJar()

//
// Modules
//

const { series, src, dest } = require("gulp");
const chalk = require("chalk");
const download = require("gulp-download-stream");
const fancyLog = require("fancy-log");
const fs = require("fs");
const htmlmin = require('gulp-html-minifier-terser');
const https = require("https");
const ini = require("ini");
const matchAll = require("string.prototype.matchall");
const minimist = require("minimist");
const prettyBytes = require("pretty-bytes");
const rename = require("gulp-rename");
const through2 = require("through2");
const { spawn } = require("child_process");
const UglifyJS = require("uglify-js");
const Vinyl = require("vinyl");

//
// Command-line arguments
//

const knownOptions = {
  boolean: ["embed-archive-js"],
  string: ["architectures", "build-server", "settings", "variant", "texture-compression"],
  default: {
    architectures: "wasm-web",
    "embed-archive-js": true,
    "build-server": "https://build.defold.com",
    "texture-compression": "true",
    variant: "release",
  },
};

const options = minimist(process.argv.slice(2), knownOptions);
const architectures = options["architectures"].split(",").map(v => v.trim());

//
// Helper functions
//

function logFilesize(filename, type, size, maxSize) {
  fancyLog("* " + chalk.cyan(filename) + type + " size " + chalk.magenta(size + " B (" + prettyBytes(size) + ")"));
  if (maxSize && size > maxSize) {
    fancyLog("⚠️⚠️⚠️ The result exceeds " + prettyBytes(maxSize));
  }
}

function stripBase64(b64) {
  if (b64.endsWith("==")) {
    return b64.substr(0, b64.length - 2);
  } else if (b64.endsWith("=")) {
    return b64.substr(0, b64.length - 1);
  } else {
    return b64;
  }
}

function modifyAndMinifyJs(filename, contents) {
  if (filename == "dmloader.js") {
    if (!architectures.includes("wasm-web")) {
      contents = contents.replace(
        /(isWASMSupported:)(.|[\r\n])+?}\)\(\),/,
        "$1 false,"
      );
    }

    contents = contents.replace(
      // We use our custom XMLHttpRequest to load files from the embedded archive.
      /XMLHttpRequest/g,
      "ArchiveJsRequest"
    );
  }

  const result = UglifyJS.minify(contents, { parse: { bare_returns: true } });
  if (result.error) {
    console.warn(result.error);
    return contents;
  }

  return result.code.replace(/;$/, "");
}

function zstdCompress(data, options, callback) {
  let compressed = Buffer.alloc(0);
  const cmd = spawn(
    "zstd",
    ["-c", "-19", "-"],
    { stdio: ["pipe", "pipe", "inherit"] },
  );
  cmd.stdout.on("data", function(data) {
    compressed = Buffer.concat([compressed, data]);
  });
  cmd.on("close", function(code) {
    if (code != 0) {
      callback("Can't compress the data");
      return;
    }
    callback(null, compressed);
  });
  cmd.on("error", function(err) {
    // skip
    // console.error(err);
  });
  cmd.stdin.write(data);
  cmd.stdin.end();
}

//
// Gulp tasks
//

function parseProjectConfig(cb) {
  const config = ini.parse(fs.readFileSync(projectDir + "/game.project", "utf-8"));
  if (config.project && config.project.title) {
    projectTitle = config.project.title;
	sanitisedTitle = projectTitle.replace(new RegExp("[^a-zA-Z0-9_]", 'g'), "");
  }
  fancyLog("* Project title is '" + chalk.cyan(projectTitle) + "'");
  fancyLog("* Sanitised title is '" + chalk.cyan(sanitisedTitle) + "'");
  cb();
}

function zstdIsInstalled(cb) {
  var cmd = spawn("zstd", ["--version"], {
    stdio: "inherit",
  });
  cmd.on("close", function (code) {
    if (code != 0) {
      throw "Can't run the `zstd` executable. More info: https://facebook.github.io/zstd/";
    }
    cb();
  });
  cmd.on("error", function (err) {
    // skip
  });
}

function javaIsInstalled(cb) {
  var cmd = spawn("java", ["-version"], {
    stdio: "inherit",
  });
  cmd.on("close", function (code) {
    if (code != 0) {
      throw "Can't run the `java` executable. Download it from: https://www.java.com/en/download/";
    }
    cb();
  });
  cmd.on("error", function (err) {
    // skip
  });
}

function fetchBobVersionInfo(cb) {
  https
    .get(bobJarVersionInfoUrl, function (res) {
      res.setEncoding("utf8");

      let body = "";
      res.on("data", function (data) {
        body += data;
      });
      res.on("end", function () {
        bobJarVersionInfo = JSON.parse(body);

        if (!/^[a-f0-9]{40}$/i.test(bobJarVersionInfo.sha1)) {
          throw "Invalid bob.jar SHA-1.";
        }

        cb();
      });
    })
    .on("error", function (e) {
      cb(e);
    });
}

function downloadBobJar(cb) {
  const bobJarDownloadUrl = "https://d.defold.com/archive/" + bobJarVersionInfo.sha1 + "/bob/bob.jar";
  bobJarFilename = "bob_" + bobJarVersionInfo.sha1.substr(0, 7) + ".jar";
  bobJarPath = bobJarDir + "/" + bobJarFilename;

  if (fs.existsSync(bobJarPath)) {
    cb();
  } else {
    return download([
      {
        file: bobJarFilename,
        url: bobJarDownloadUrl,
      },
    ]).pipe(dest(bobJarDir));
  }
}

function checkBobJar(cb) {
  const cmd = spawn("java", ["-jar", bobJarPath, "--version"], {
    stdio: "inherit",
  });
  cmd.on("close", function (code) {
    if (code != 0) {
      throw "bob.jar is invalid.";
    }
    cb();
  });
  cmd.on("error", function (err) {
    // skip
  });
}

function buildGame(cb) {
  const command = "java";
  const args = [].concat(
    [
      "-jar", playableAdDir + "/" + bobJarPath,
      "--email", "foo@bar.com",
      "--auth", "12345",
      "--build-server", options["build-server"],
      "--variant", options.variant,
      "--texture-compression", options["texture-compression"],
      "--settings", playableAdDir + "/" + buildSettingsPath,
    ],
    (options.settings ? [options.settings] : []),
    [
      "--bundle-output", playableAdDir + "/" + bundleJsWebPath,
      "--platform", "js-web",
      "--architectures", architectures.join(","),
      "--archive",
      "distclean",
      "resolve",
      "build",
      "bundle",
    ]);

  console.log(command, args.join(" "));

  const cmd = spawn(command, args, { cwd: projectDir, stdio: "inherit" });
  cmd.on("close", function (code) {
    if (code != 0) {
      throw "Can't build the game.";
    }
    cb();
  });
  cmd.on("error", function (err) {
    console.err(err);
  });
}

function combineFilesToBase64(out) {
  let combinedFiles = {};

  return through2.obj(
    function (file, _, cb) {
      if (file.isNull()) {
        cb(null, file);
        return;
      }

      if (file.isStream()) {
        this.emit("error", new Error("Streaming not supported"));
        return cb();
      }

      const archiveFilename = file.relative.replace("\\", "/"); // Windows fix
      const fileContents = fs.readFileSync(file.path);
      zstdCompress(fileContents, {}, function (err, deflated) {
        if (err) {
          cb(err);
          return;
        }
        const compressed = stripBase64(Buffer.from(deflated).toString("base64"));
        combinedFiles[archiveFilename] = [fileContents.length, compressed];
        logFilesize(archiveFilename, " zstd + base64 encoded", compressed.length);
        cb();
      });
    },
    function (cb) {
      const prefix = "var ARCHIVEJS_DATA = ";
      const buffer = Buffer.from(prefix + JSON.stringify(combinedFiles, null, "  "));
      const fileListFile = new Vinyl({
        path: out,
        contents: buffer,
      });
      this.push(fileListFile);
      cb();
    }
  );
}

function copyFzstd() {
  const dir = bundleJsWebPath + "/" + projectTitle;
  return src("node_modules/fzstd/umd/index.js").pipe(rename("fzstd.js")).pipe(dest(dir));
}

function bundleArchiveJs() {
  const dir = bundleJsWebPath + "/" + projectTitle;

  let files = [];
  if (architectures.includes("wasm-web")) {
    files.push(sanitisedTitle + "_wasm.js");
    files.push(sanitisedTitle + ".wasm");
  }
  if (architectures.includes("js-web")) {
    files.push(sanitisedTitle + "_asmjs.js");
  }
  files.push(archiveDir + "/*");

  return src(files, { base: dir + "/", cwd: dir + "/" })
    .pipe(combineFilesToBase64(sanitisedTitle + "_archive.js"))
    .pipe(dest(dir + "/"));
}

function removeRunningFromFileWarning() {
  return through2.obj(function (file, _, cb) {
    if (file.isBuffer()) {
      const input = file.contents.toString();
      const output = input.replace('window.location.href.startsWith("file://")', 'false');
      file.contents = Buffer.from(output);
    }
    cb(null, file);
  });
}

function embedImages(dir) {
  return through2.obj(function (file, _, cb) {
    if (file.isBuffer()) {
      const input = file.contents.toString();
      let output = input;
      let matches = matchAll(input, /(url\(")(.+?\.(png|jpg))("\))/g);
      for (const match of matches) {
        const searchMatch = match[0];
        const filename = match[2];
        const fspath = dir + "/" + filename;

        const imageData = fs.readFileSync(fspath);
        const dataUriData = "data:image/" + match[3] + ";base64," + Buffer.from(imageData).toString("base64");
        const replacement = match[1] + dataUriData + match[4];
        output = output.split(searchMatch).join(replacement);

        logFilesize(filename, " base64 encoded", replacement.length);
      }
      file.contents = Buffer.from(output);
    }
    cb(null, file);
  });
}

function embedJs(dir) {
  return through2.obj(function (file, _, cb) {
    if (file.isBuffer()) {
      const input = file.contents.toString();
      let output = input;

      const matches = Array.from(matchAll(input, /<script [^>]*?(data-)?src="(.+?)" embed(="(compress)")?><\/script>/g)).map(function (match) {
          return {
            searchMatch: match[0],
            filename: match[2],
            compress: match[4] == "compress",
          script: true
        }
      }).concat(Array.from(matchAll(input, /\/\/ EMBED: (.+)/g)).map(function(match) {
            return {
              searchMatch: match[0],
              filename: match[1],
        }
      }));

      const promises = Array.from(matches).map(function (match) {
        return new Promise(function (cb) {
          if (match.filename.endsWith("_archive.js")) {
            if (options["embed-archive-js"] == false) {
              // Skip embedding the _archive.js file
              if (match.script) {
                fancyLog("* " + chalk.cyan(match.filename) + " skipped, will be loaded as an external file");
                const replacement = "<script src=\"" + match.filename + "\"></script>";
                output = output.split(match.searchMatch).join(replacement);
              } else {
                fancyLog("* " + chalk.cyan(match.filename) + " skipped");
              }
              cb();
              return;
            }
          }

          const fspath = dir + "/" + match.filename;
          const fileContents = fs.readFileSync(fspath, "utf-8");
          const modified = modifyAndMinifyJs(match.filename, fileContents);
          // console.log(modified);
          if (!match.compress) {
            const replacement = match.script ? "<script>" + modified + "\n</script>" : modified;
            output = output.split(match.searchMatch).join(replacement);
            logFilesize(match.filename, "", replacement.length);
            cb();
          } else {
            zstdCompress(Buffer.from(modified, "utf-8"), {}, function (err, zstdOutput) {
              if (err) {
                cb(err);
                return;
              }
              const compressed = stripBase64(Buffer.from(zstdOutput).toString("base64"));
              const replacement = "<script>eval(Zstd_DecStr('" + compressed + "'));</script>";
              output = output.split(match.searchMatch).join(replacement);
              logFilesize(match.filename, " zstd + base64 encoded", replacement.length);
              cb();
            });
          }
        });
      });

      Promise.all(promises).then(function () {
        file.contents = Buffer.from(output);

        cb(null, file);
      });
    } else {
      cb(null, file);
    }
  });
}

function printSize(type, maxSize) {
  return through2.obj(function (file, _, cb) {
    if (file.isBuffer()) {
      logFilesize(file.relative, type, file.contents.length, maxSize);
    }
    cb(null, file);
  });
}

function bundlePlayableAds() {
  const dir = bundleJsWebPath + "/" + projectTitle;
  return src(dir + "/index.html")
    .pipe(removeRunningFromFileWarning())
    .pipe(embedImages(dir))
    .pipe(embedJs(dir))
    .pipe(rename(sanitisedTitle + ".html"))
    .pipe(
      htmlmin({
        collapseWhitespace: true,
        preserveLineBreaks: true,
        removeComments: true,
        minifyCSS: true,
        minifyJS: {
          compress: {
            sequences: false
          }
        },
      })
    )
    .pipe(printSize(" resulting", 2 * 1024 * 1024))
    .pipe(dest(dir));
}

exports.default = series(
  parseProjectConfig,
  zstdIsInstalled,
  javaIsInstalled,
  fetchBobVersionInfo,
  downloadBobJar,
  checkBobJar,
  buildGame,
  copyFzstd,
  bundleArchiveJs,
  bundlePlayableAds
);
