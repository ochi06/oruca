module.exports = {
  expo: {
    name: 'app',
    slug: 'app',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.example.oruca', // 仮の識別子。Must完了後に再検討する
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    },
    android: {
      package: 'com.example.oruca', // 仮のパッケージ名。Must完了後に再検討する
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-font',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'oruca は、アプリの利用中に位置情報を取得し、登録したエリアに入っているかどうかを判定します。位置情報はエリア外にいる間も取得されますが、保存・送信されるのはエリア内にいるかどうかの判定結果のみです。',
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission:
            'oruca は、友達追加時にQRコードを読み取るためにカメラを使用します。',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'oruca は、プロフィールアイコンを設定するために写真ライブラリへのアクセスを使用します。',
        },
      ],
      './plugins/withFixMapsPodname',
    ],
  },
};
