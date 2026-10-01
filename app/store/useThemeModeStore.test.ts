import { useThemeModeStore } from './useThemeModeStore';

beforeEach(() => {
  useThemeModeStore.setState({ mode: 'system' });
});

describe('useThemeModeStore', () => {
  it('デフォルトはsystem', () => {
    expect(useThemeModeStore.getState().mode).toBe('system');
  });

  it('setModeで選択したモードに切り替わる', () => {
    useThemeModeStore.getState().setMode('dark');
    expect(useThemeModeStore.getState().mode).toBe('dark');

    useThemeModeStore.getState().setMode('light');
    expect(useThemeModeStore.getState().mode).toBe('light');
  });
});
