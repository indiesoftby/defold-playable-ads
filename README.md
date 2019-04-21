# Defold for Playable Ads

This project was created from the "mobile" project template. 

This project contains the [Gulp](https://gulpjs.com/) task, which:
1. Downloads [bob.jar](https://d.defold.com/stable/).
2. Builds the project for the HTML5 platform using `bob.jar`.
3. Combines all resources into one large HTML file.

The asm.js binary of the Defold engine is compressed using zlib deflate.

## Required Prerequisites

You will need Node.js, Java and Gulp CLI installed on your environment.

### WSL and Linux

```
sudo apt install -y --no-install-recommends java nodejs npm

npm install --global gulp-cli
```

### macOS

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

Run the `gulp` command to start the build process.

The resulting HTML file is located at `/build/bundle/js-web/playable_ads/playable_ads.html`.
