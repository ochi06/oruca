import { resolveGroupMemberDisplay } from './users';

const fallback = { name: '本名太郎', iconUrl: 'https://example.com/real-icon.jpg' };

describe('resolveGroupMemberDisplay', () => {
  it('display_name/display_icon_url未設定時はUSERS側にフォールバックする', () => {
    const result = resolveGroupMemberDisplay({ display_name: null, display_icon_url: null }, fallback);
    expect(result).toEqual(fallback);
  });

  it('display_nameのみ設定されている場合、名前だけ上書きしアイコンはフォールバックする', () => {
    const result = resolveGroupMemberDisplay(
      { display_name: '匿名参加者', display_icon_url: null },
      fallback
    );
    expect(result).toEqual({ name: '匿名参加者', iconUrl: fallback.iconUrl });
  });

  it('両方設定されている場合、両方とも上書きする', () => {
    const result = resolveGroupMemberDisplay(
      { display_name: '匿名参加者', display_icon_url: 'https://example.com/anon-icon.jpg' },
      fallback
    );
    expect(result).toEqual({ name: '匿名参加者', iconUrl: 'https://example.com/anon-icon.jpg' });
  });
});
