import {
  computeOpenGroupExpiresAt,
  validateGroupTypeAndArea,
  isExpiredOpenGroup,
  canSeeOpenGroupPresence,
} from './groupOpenType';

describe('computeOpenGroupExpiresAt', () => {
  it('created_atの7日後を返す', () => {
    const createdAt = new Date('2026-10-01T00:00:00.000Z');
    expect(computeOpenGroupExpiresAt(createdAt)).toBe('2026-10-08T00:00:00.000Z');
  });
});

describe('validateGroupTypeAndArea', () => {
  it('area_idが無ければarea_required（Issue #204、typeによらず必須）', () => {
    expect(validateGroupTypeAndArea(null)).toBe('area_required');
  });

  it('area_idがあればOK', () => {
    expect(validateGroupTypeAndArea('area-1')).toBeNull();
  });
});

describe('isExpiredOpenGroup', () => {
  const now = new Date('2026-10-10T00:00:00.000Z');

  it('closedグループは常にfalse', () => {
    expect(isExpiredOpenGroup({ type: 'closed', expires_at: '2026-01-01T00:00:00.000Z' }, now)).toBe(false);
  });

  it('expires_at未設定のopenはfalse', () => {
    expect(isExpiredOpenGroup({ type: 'open', expires_at: null }, now)).toBe(false);
  });

  it('expires_atを過ぎたopenはtrue', () => {
    expect(isExpiredOpenGroup({ type: 'open', expires_at: '2026-10-09T00:00:00.000Z' }, now)).toBe(true);
  });

  it('expires_atちょうどはtrue（失効済み扱い）', () => {
    expect(isExpiredOpenGroup({ type: 'open', expires_at: '2026-10-10T00:00:00.000Z' }, now)).toBe(true);
  });

  it('expires_at前のopenはfalse', () => {
    expect(isExpiredOpenGroup({ type: 'open', expires_at: '2026-10-11T00:00:00.000Z' }, now)).toBe(false);
  });
});

describe('canSeeOpenGroupPresence', () => {
  it('closedグループは常にtrue', () => {
    expect(canSeeOpenGroupPresence({ type: 'closed' }, false)).toBe(true);
  });

  it('openグループは自分が在席中ならtrue', () => {
    expect(canSeeOpenGroupPresence({ type: 'open' }, true)).toBe(true);
  });

  it('openグループは自分が不在ならfalse', () => {
    expect(canSeeOpenGroupPresence({ type: 'open' }, false)).toBe(false);
  });
});
