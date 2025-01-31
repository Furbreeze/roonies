# Simple Jagex Launcher on Linux

The aim here was to make a dead simple OAuth implementation to support using the Jagex Launcher on linux. Source code is available and succint. While not feature rich, this will allow you to play OSRS on linux with a jagex account. This method does require re-logging and using 2FA every time you launch, as it does not cache credentials like other clients do. The bones are here, feel free to extend and make niceties as you see fit. It works for me as is.

## Requirements
* NodeJS 18
* Java
* Runelite

## Configuring
Edit the main.js and fill in the following variables. Instructions on how to get your OSRS_CHARACTER_ID can be found [here](https://github.com/runelite/runelite/wiki/Using-Jagex-Accounts)

```javascript
const JAVA_PATH = "<your_path_to_java_bin>";
const RUNELITE_PATH = "<your_path_to_java_bin>";
const OSRS_CHARACTER_ID = "<your_acct_id>";
const OSRS_DISPLAY_NAME = "<your_character_name>";
```

## Running
Ensure you have the requirements above installed and have followed the configuring section. From there install the dependencies with `npm install` in the root directory of the project and finally run with `npm run start`