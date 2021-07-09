# Defold for Playable Ads

This repository contains a script for the [Gulp](https://gulpjs.com/) build system, which:
1. Downloads [bob.jar](https://d.defold.com/stable/).
2. Builds the project for the HTML5 platform using `bob.jar`.
3. Combines all resources into **a single HTML file**. The asm.js binary of the Defold engine is compressed using zlib deflate.

[**Open the build result**](https://aglitchman.github.io/defold-playable-ads/) online. Please note that it does not use any external resources as required.

## Current Status

Feel free to ask questions: [the topic about this asset is on the Defold forum](https://forum.defold.com/t/defold-for-playable-ads/68689).

| Tool Version   | Defold Version | Status        |
| -------------- | -------------- | ------------- |
| 1.0.0          | 1.2.184        | Tested ✅     |

## About A Playable Ad

A [playable ad](https://learn.g2crowd.com/playable-ads) is an interactive advertisement, mostly used to promote mobile games. A playable ad acts as a demo of the game (or product), allowing users to quickly play the game directly in the ad before downloading it.

Accepted sizes for HTML5 playable ad vary between ad networks:
1. [Facebook specifications for Playable Ads](https://www.facebook.com/business/help/412951382532338?helpref=faq_content) require that there be a single file for playable ad that contains all assets as part of that single HTML file and assets should be data uri compressed. Also playable asset size should be less than 2MB. And Facebook has started accepting .zip archives with up to 5MB since 2020.
2. [Google](https://support.google.com/google-ads/answer/9981650?hl=en) requires a .ZIP file with a maximum size of 5MB and no more than 512 files within the .ZIP. Plus .ZIP files can contain the following formats: HTML, CSS, JS, GIF, PNG, JPG, JPEG, SVG.
3. [ironSource](https://demos.ironsrc.com/test-tool/?adUnitLoader=dapi&mode=testing), AppLovin, and Unity Ads require a single HTML file. The maximum ad size is 5MB.

## Required Prerequisites

You will need Node.js, Java 11 and Gulp CLI installed on your environment.

### Windows

1. Download [Node.js Windows Installer (.msi) for 64-bit](https://nodejs.org/en/download/) and install it.
2. Download and install [Java 11](https://adoptopenjdk.net/).
3. Open `cmd.exe` and run to install Gulp CLI:

```
npm install --global gulp-cli
```

### Ubuntu/Debian or [Windows Subsystem for Linux (WSL)](https://docs.microsoft.com/en-us/windows/wsl/about)

```
sudo apt install --no-install-recommends openjdk-11-jre-headless nodejs npm

npm install --global gulp-cli
```

### macOS

Install [brew](https://brew.sh/) and paste that in a macOS Terminal prompt:

```
brew install node@14
brew install openjdk@11

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
--embed-archive-js <arg>        Embed `_archive.js` file: true/false (default = true).

# The following arguments passed to Bob.jar as is:
--build-server <arg>            The build server (default = https://build.defold.com).
--settings <arg>                Path to a game project settings file. Only one occurrance is allowed.
--variant <arg>                 Specify debug or release (default = release).
--texture-compression <arg>     Use texture compression as specified in texture profiles (default = true).
```

## License

MIT.
