const { withPodfile } = require('expo/config-plugins');

/**
 * expo の組み込み Maps 設定プラグイン（@expo/config-plugins の ios/Maps.ts）が
 * Podfile に古い pod 名 `react-native-google-maps` を書き込むが、
 * react-native-maps 1.x のpodspec名は `react-native-maps` に変わっているため
 * ビルドが失敗する（Issue #76）。
 * prebuild後にPodfileの当該行を実際のpod名に置換して整合させる。
 */
const withFixMapsPodname = (config) => {
  return withPodfile(config, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      "pod 'react-native-google-maps'",
      "pod 'react-native-maps'"
    );
    return config;
  });
};

module.exports = withFixMapsPodname;
