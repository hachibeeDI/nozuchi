# Changelog

## [0.1.0] - 2026-04-13

### Features

- **Symbol.observable サポート**: RxJS など Observable を扱うライブラリとの相互運用性を実現。`symbolObservable` を内部ポリフィルとして export し、`declare global` を除去してクリーンな実装に変更。
- **npm publish CI ワークフロー**: `v*` タグをプッシュすると GitHub Actions が自動で npm publish するワークフローを追加。OIDC (Trusted Publishing) による安全な認証を採用。

### Bug Fixes

- **Observable のバグ修正**: マルチキャスト・完了フラグ・エラー伝播に関する複数のバグを修正。
- **isPrimitive の修正**: すべての JS プリミティブ型（`bigint`、`symbol` など）を正しく判定するよう修正。
- **CI の修正**: `yarn install` がスキップされ biome が見つからない問題を修正。テストファイルをビルド出力から除外。

### Documentation

- **JSDoc コメント**: export されるすべての API に JSDoc コメントとサンプルコードを追加。
- **README 全面改訂**: インストール手順・API リファレンス・使用例を整備。

---

## [0.0.13] and earlier

以前のリリース履歴は git log を参照してください。
