/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { withAndroidColorsNight, AndroidConfig } = require("expo/config-plugins");

// 原生父主题已是 DayNight，缺的只是这份夜间色值；不补则系统深色下开 App 先白闪一帧
const NIGHT_BACKGROUND = "#0f172a";

function withAndroidNightColors(config) {
    return withAndroidColorsNight(config, (mod) => {
        mod.modResults = AndroidConfig.Colors.assignColorValue(mod.modResults, {
            name: "activityBackground",
            value: NIGHT_BACKGROUND,
        });
        mod.modResults = AndroidConfig.Colors.assignColorValue(mod.modResults, {
            name: "splashscreen_background",
            value: NIGHT_BACKGROUND,
        });
        return mod;
    });
}

module.exports = withAndroidNightColors;
