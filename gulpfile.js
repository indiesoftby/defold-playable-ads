const { series, src, dest } = require("gulp");
const download = require("gulp-download-stream");
const fs = require("fs");
const htmlmin = require("gulp-htmlmin");
const matchAll = require("string.prototype.matchall");
const pako = require("pako");
const rename = require("gulp-rename");
const replace = require("gulp-replace");
const through2 = require("through2");
const size = require("gulp-size");
const spawn = require("child_process").spawn;
const Vinyl = require("vinyl");

const projectTitle = "playable_ads";
const bobJarDownloadUrl =
  "https://d.defold.com/archive/e05232d70b8a6d8c69fcfe968f01b876090ffa06/bob/bob.jar";

const buildDir = "build";
const archiveDir = "archive";
const bundleJsWebPath = buildDir + "/bundle/js-web";
const bobJarPath = buildDir + "/bob.jar";

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
        file: "bob.jar",
        url: bobJarDownloadUrl
      }
    ]).pipe(dest(buildDir));
  }
}

function checkBobJar(cb) {
  var cmd = spawn("java", ["-jar", bobJarPath, "--version"], {
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
  var cmd = spawn(
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
      fs.readFile(file.path, { encoding: "base64" }, (err, data) => {
        if (err) {
          throw err;
        }
        combinedFiles[archiveFilename] = data;
        cb();
      });
    },
    function(cb) {
      var prefix = "var embed_archive_data = ";
      var buffer = new Buffer(
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
          new Buffer(imageData).toString("base64");
        const replacement = match[1] + dataUriData + match[4];
        output = output.split(searchMatch).join(replacement);
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
      let matches = matchAll(
        input,
        /<script (data-)?src="(.+?)" embed(="(compress)")?><\/script>/g
      );
      for (const match of matches) {
        const searchMatch = match[0];
        const filename = match[2];
        const fspath = dir + "/" + filename;
        const compress = match[4] == "compress";

        if (!compress) {
          const filetext = fs.readFileSync(fspath, "utf-8");
          const replacement = "<script>" + filetext + "\n</script>";
          output = output.split(searchMatch).join(replacement);
        } else {
          const filetext = fs.readFileSync(fspath, "utf-8");
          const compressed = new Buffer(
            pako.deflate(filetext, { level: 8 })
          ).toString("base64");
          const replacement =
            "<script>eval(pako.inflate(atob('" +
            compressed +
            "'), { to: 'string' }));</script>";
          output = output.split(searchMatch).join(replacement);
        }
      }
      file.contents = Buffer.from(output);
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
    .pipe(
      htmlmin({
        collapseWhitespace: true,
        preserveLineBreaks: true,
        minifyCSS: true,
        minifyJS: true
      })
    )
    .pipe(rename(projectTitle + ".html"))
    .pipe(size({ title: "Resulting filesize:", showFiles: true }))
    .pipe(dest(dir));
}

exports.default = series(
  javaIsInstalled,
  downloadBobJar,
  checkBobJar,
  buildGame,
  copyPakoJs,
  archiveToBase64,
  bundlePlayableAds
);
