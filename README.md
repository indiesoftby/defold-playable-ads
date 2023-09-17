# Defold for Playable Ads

This repository contains a script for the [Gulp](https://gulpjs.com/) build system, which:
1. Downloads [bob.jar](https://d.defold.com/stable/).
2. Builds the project for the HTML5 platform using `bob.jar`.
3. Combines all resources into **a single HTML file**. The asm.js binary of the Defold engine is compressed using Zstd and encoded with Base64.

[**Open the build result**](https://aglitchman.github.io/defold-playable-ads/) online. 

Please note that the example build doesn't use any external resources as required. The total size is less than 1 megabyte! In this example, BasisU Decoder, Physics, Live Update are disabled in the engine.

## Current Status

Feel free to ask questions: [the topic about this asset is on the Defold forum](https://forum.defold.com/t/defold-for-playable-ads/68689).

| Tool Version   | Defold Version | Status        |
| -------------- | -------------- | ------------- |
| 1.3.0          | 1.5.0          | Tested ✅     |

### Supported Platforms

| Platform | Status | Extra |
| ---------| -------| ----- |
| [Facebook](https://developers.facebook.com/tools/playable-preview/) | Supported ✅ |
| [Unity Ads](https://unityads.unity3d.com/help/advertising/campaign-design-guide), [AppLovin](https://p.applov.in/playablePreview?create=1&qr=1), etc | Can be done on request ⏩ |  |

## About A Playable Ad

A [playable ad](https://learn.g2crowd.com/playable-ads) is an interactive advertisement, mostly used to promote mobile games. A playable ad acts as a demo of the game (or product), allowing users to quickly play the game directly in the ad before downloading it.

Accepted sizes for HTML5 playable ad vary between ad networks:
1. [Facebook specifications for Playable Ads](https://www.facebook.com/business/help/412951382532338?helpref=faq_content) require that there be a single file for playable ad that contains all assets as part of that single HTML file and assets should be data uri compressed. Also playable asset size should be less than 2MB. And Facebook has started accepting .zip archives with up to 5MB since 2020.
2. [Google](https://support.google.com/google-ads/answer/9981650?hl=en) requires a .ZIP file with a maximum size of 5MB and no more than 512 files within the .ZIP. Plus .ZIP files can contain the following formats: HTML, CSS, JS, GIF, PNG, JPG, JPEG, SVG.
3. [AppLovin](https://p.applov.in/playablePreview?create=1&qr=1), and Unity Ads require a single HTML file. The maximum ad size is 5MB.

## Required Prerequisites

You will need the following apps installed on your environment:
- Node.js 12 or newer.
- Java 17 (Defold >=1.4.8).
- Zstd 1.4 or newer.
- Gulp CLI.

### Windows

1. Download and install [Java 17](https://adoptium.net/).
2. Download and unpack [Zstd for Windows 64-bit](https://github.com/facebook/zstd/releases/download/v1.5.5/zstd-v1.5.5-win64.zip). Add the path to the `zstd.exe` executable to the PATH environment variable.
3. Download [Node.js Windows Installer (.msi) for 64-bit](https://nodejs.org/en/download/) and install it.
4. Open `cmd.exe` and run to install Gulp CLI:

```
npm install --global gulp-cli
```

### Ubuntu/Debian or [Windows Subsystem for Linux (WSL)](https://docs.microsoft.com/en-us/windows/wsl/about)

```
sudo apt install --no-install-recommends openjdk-17-jre-headless nodejs npm zstd

npm install --global gulp-cli
```

### macOS

Install [brew](https://brew.sh/) and paste that in a macOS Terminal prompt:

```
brew install node@18
brew install openjdk@17
brew install zstd@1.5.5

npm install --global gulp-cli
```

## Installation & Usage

Copy the `playable_ad` folder into the root of your project + the `.defignore` file. Then, in the command line:

```
cd your_project_folder
cd playable_ad
npm install
gulp
```

`npm install` installs required NodeJS packages. `gulp` builds the project into a single HTML file.

The resulting HTML file is located at `/playable_ad/build/output_js-web/YOUR_PROJECT_TITLE/YOUR_PROJECT_TITLE.html`.

### Command Line Arguments

You can pass the following arguments from the command line to the script:

```bash
--architectures <arg>           Comma separated list of architectures to include: js-web,wasm-web (default = wasm-web).
--embed-archive-js <arg>        Embed `_archive.js` file: true/false (default = true).

# The following arguments passed to Bob.jar as is:
--build-server <arg>            The build server (default = https://build.defold.com).
--settings <arg>                Path to a game project settings file. Only one occurrance is allowed.
--variant <arg>                 Specify debug or release (default = release).
--texture-compression <arg>     Use texture compression as specified in texture profiles (default = true).
```

i.e. run `gulp --embed-archive-js=false` to build a playable ad with the two files:

* `/playable_ad/build/output_js-web/YOUR_PROJECT_TITLE/YOUR_PROJECT_TITLE.html`
* `/playable_ad/build/output_js-web/YOUR_PROJECT_TITLE/YOUR_PROJECT_TITLE_archive.js`

### How To Shrink Your Game Size

Follow these steps to decrease the resulting size of the HTML file significantly:

1. Use the [Defold App Manifest generator](https://britzl.github.io/manifestation/) to keep only the necessary parts of the engine.
2. Keep only the core mechanic of your game and all assets that it requires.
3. Toy with the [`Project` / `Compress Archive`](https://defold.com/manuals/project-settings/) option. Zstd, used by this tool, compresses plain data better than a compressed LZ4 stream.
4. Install the latest version of the [Zstd executable](https://github.com/facebook/zstd/releases) (i.e. Zstd 1.5.0 has better compression than Zstd 1.4.x).

And, the last tip: set [HTML5 heap size](https://defold.com/manuals/project-settings/#heap-size) as small as possible (minimum is 32MB, default is 256MB) to allow your game to run on low-end Android devices.

## License

MIT.

The splash uses an image from [iconfinder.com](https://www.iconfinder.com/icons/1222768/facebook_ads_facebook_marketing_marketing_icon).
