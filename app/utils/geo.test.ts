import { roundCoordinate } from './geo';

// Issue #336：presence_logs.lat/lngをAREASと同じ精度（小数点6桁、約11cm）に
// 丸めて保存する際に使うroundCoordinateのテスト
describe('roundCoordinate', () => {
  test('小数点7桁以降を四捨五入して6桁に丸める', () => {
    expect(roundCoordinate(35.1234567)).toBe(35.123457);
  });

  test('既に6桁以下の値はそのまま返す', () => {
    expect(roundCoordinate(35.123456)).toBe(35.123456);
  });

  test('負の値（西経・南緯）も丸められる', () => {
    expect(roundCoordinate(-139.1234567)).toBe(-139.123457);
  });

  test('整数値はそのまま返す', () => {
    expect(roundCoordinate(35)).toBe(35);
  });
});
