// グループの招待コード（GROUPS.invite_code）を生成する（Issue #116）。
// 招待コードを知っていれば誰でも参加申請できる仕組みのため（docs/schema.md参照）、
// 総当たりされにくいよう英大文字＋数字の組み合わせにする（エリア参加コード
// KOBE2026と同様の桁数感で6文字）
const INVITE_CODE_LENGTH = 6;
const INVITE_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
  }
  return code;
}
