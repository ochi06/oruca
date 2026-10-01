import * as Sentry from '@sentry/react-native';

import { isLocationRelatedRequest, scrubSensitiveKeys } from '../utils/sentryScrub';

// クラッシュ・エラーレポート基盤（Issue #27）。
// oruca は位置情報を扱うプライバシー重視のアプリであるため（docs/oruca_PRD.md）、
// 緯度経度などの機微データが外部サービス（Sentry）に送信されないことを徹底する：
// - sendDefaultPii: false（IPアドレス等のデフォルト収集を無効化）
// - beforeBreadcrumb：位置情報を含みうるSupabaseリクエストのbreadcrumbを破棄
// - beforeSend：イベント全体（extra/contexts/breadcrumbsのdata）から
//   lat/lng系のキーを再帰的にredactする（多重防御。scrubSensitiveKeys/
//   isLocationRelatedRequestの単体テストはapp/utils/sentryScrub.test.ts参照）
//
// DSNが未設定（.env.development等にEXPO_PUBLIC_SENTRY_DSNが無い）の場合は
// 初期化自体をスキップする。ローカル開発でSentryプロジェクトを持たない
// チャットでもアプリが問題なく起動できるようにするため
export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    sendDefaultPii: false,
    beforeBreadcrumb: (breadcrumb) => {
      if (breadcrumb.category === 'http' && isLocationRelatedRequest(breadcrumb.data?.url as string)) {
        return null;
      }
      return breadcrumb;
    },
    beforeSend: (event) => {
      event.extra = scrubSensitiveKeys(event.extra);
      event.contexts = scrubSensitiveKeys(event.contexts);
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
          ...breadcrumb,
          data: scrubSensitiveKeys(breadcrumb.data),
        }));
      }
      return event;
    },
  });
}

export { Sentry };
