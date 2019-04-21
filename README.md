# Defold for Playable Ads

[Specifications for Playable Ads](https://www.facebook.com/business/help/412951382532338?helpref=faq_content) require that there be a single file for playable ad that contains all assets as part of that single HTML file and assets should be data uri compressed. Also playable asset size should be less than 2MB.

This project contains the [Gulp](https://gulpjs.com/) task, which:
1. Downloads [bob.jar](https://d.defold.com/stable/).
2. Builds the project for the HTML5 platform using `bob.jar`.
3. Combines all resources into one large HTML file.

The asm.js binary of the Defold engine is compressed using zlib deflate.

This project was created from the "mobile" project template. 

## Required Prerequisites

You will need Node.js, Java and Gulp CLI installed on your environment.

### Ubuntu/Debian or Windows Subsystem for Linux (WSL)

```
sudo apt install -y --no-install-recommends java nodejs npm

npm install --global gulp-cli
```

### macOS

Install [brew](https://brew.sh/) and paste that in a macOS Terminal prompt:

```
brew install node
brew cask install java

npm install --global gulp-cli
```

## Installation

```
git clone https://github.com/aglitchman/defold-playable-ads.git
cd defold-playable-ads
npm install
```

## Usage

Run the `gulp` command to start the build process:

![Command line](docs/gulp.gif)

The resulting HTML file is located at `/build/bundle/js-web/playable_ads/playable_ads.html`.

This project uses `bob.jar` version `1.2.151`. Change the download link `bobJarDownloadUrl` in `gulpfile.js` to use other version.
