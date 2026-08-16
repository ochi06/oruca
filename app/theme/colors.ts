// oruca の配色。docs/design-system.md の内容と対応させること。

export const lightColors = {
  navy: '#0B2545',
  blue: '#2E6F9E',
  lightblue: '#A8D8E8',
  text: '#1A1A1A',
  textSub: '#5A6570',
  bg: '#F2F5F7',
  surface: '#FFFFFF',
  green: '#6FA96C',
  coral: '#E37B7B',
  sand: '#F5CC6E',
  sandTint: '#FBF0D9',
};

export const darkColors = {
  navy: '#0B2545',
  blue: '#5A8FBD',
  lightblue: '#6F94A8',
  text: '#E6EBEF',
  textSub: '#7C93A8',
  bg: '#050B14',
  surface: '#0E1C30',
  green: '#48A156',
  coral: '#B86868',
  sand: '#B99458',
  sandTint: '#7A5C2E',
};

export type ThemeColors = typeof lightColors;
