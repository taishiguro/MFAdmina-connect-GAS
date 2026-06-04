# MFAdmina-connect-GAS

マネーフォワード Admina の Public API を使って、**カスタムアプリ（カスタムワークスペース）を作成する** Google Apps Script (GAS) です。
Google スプレッドシートに作成情報を並べて、メニューから一括作成できます。

## 使用するAPI

`POST https://api.itmc.i.moneyforward.com/api/v1/organizations/{organizationId}/workspaces/custom`

| 項目 | 内容 |
| --- | --- |
| 認証 | Bearer トークン |
| パスパラメータ | `organizationId`（必須） |
| ボディ | `serviceId`（必須）, `workspaceName`（必須）, `customWorkspaceType`（必須・`google_sheet` / `manual_import`） |
| 成功レスポンス | `201`（`service` / `workspace` / `isNewService` を含む） |

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `src/Config.gs` | 定数、スクリプトプロパティ（APIトークン・organizationId）の管理 |
| `src/AdminaClient.gs` | Admina API 呼び出しラッパー（`createCustomWorkspace`） |
| `src/CustomWorkspace.gs` | スプレッドシート一括作成とカスタムメニュー |
| `src/appsscript.json` | マニフェスト（タイムゾーン・OAuthスコープ等） |

## セットアップ

1. Google スプレッドシートを作成し、**拡張機能 → Apps Script** を開きます。
2. `src/` 配下の各ファイルの内容を、同名のスクリプトファイルとして貼り付けます。
   （`clasp` を使う場合は `src` ディレクトリをそのまま push してください。）
3. 認証情報を **スクリプト プロパティに手動登録**します。
   - Apps Script エディタ左メニューの **プロジェクトの設定（歯車アイコン）** を開きます。
   - 一番下の **「スクリプト プロパティ」** で「スクリプト プロパティを追加」を押し、以下の2つを登録して保存します。

     | プロパティ | 値 |
     | --- | --- |
     | `ADMINA_API_TOKEN` | APIトークン |
     | `ADMINA_ORGANIZATION_ID` | organizationId（例: `123456`） |

4. スプレッドシートを再読み込みすると、メニューに **「Admina」** が追加されます。
   - 初回の機能実行時に、権限の承認を求められます。

## 使い方

1. メニュー **Admina → 入力シートを準備** を実行し、`CustomWorkspaces` シートを作成します。
2. 2行目以降に作成したいカスタムアプリを入力します。

   | serviceId | workspaceName | customWorkspaceType |
   | --- | --- | --- |
   | 1 | 営業部 経費スプレッドシート | google_sheet |
   | 2 | 手動取込アプリ | manual_import |

3. メニュー **Admina → カスタムアプリを一括作成** を実行します。
4. 各行の `status` / `workspaceId` / `message` / `processedAt` に結果が書き込まれます。
   - `status` が `成功` の行は、再実行しても二重作成されないようスキップされます。

## 単体で呼び出す場合

スプレッドシートを使わずに関数を直接呼ぶこともできます。

```javascript
function example() {
  const result = createCustomWorkspace(1, 'テストアプリ', 'google_sheet');
  Logger.log(result.status); // 201
  Logger.log(result.body.workspace.id);
}
```

## 注意事項

- APIトークンはコードに直書きせず、スクリプトプロパティに保持しています。リポジトリにトークンをコミットしないでください。
- `serviceId` は、対象組織に属する標準サービスID、またはカスタムサービスIDを指定します。
- 大量に作成する場合、レート制限に配慮して各リクエスト間に約0.3秒の待機を入れています（`CustomWorkspace.gs` で調整可能）。
