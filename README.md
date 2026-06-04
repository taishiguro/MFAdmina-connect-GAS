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
2. **`.gs` ファイル（コード）** を貼り付けます。
   - `src/Config.gs` / `src/AdminaClient.gs` / `src/CustomWorkspace.gs` の3つを、
     それぞれ同名の新しいスクリプトファイルとして作成し、中身を貼り付けます。
   - 既定の `コード.gs`（`Code.gs`）は使わないので削除して構いません。
3. **`appsscript.json`（マニフェスト）** を反映します。※ これは `.gs` ファイルではありません。
   - `.gs` ファイルとして貼り付けると `SyntaxError: Unexpected token ':'` になります。**やらないでください。**
   - 左の **プロジェクトの設定（歯車アイコン）** を開き、**「『appsscript.json』マニフェスト ファイルをエディタで表示する」にチェック**を入れます。
   - ファイル一覧に現れた `appsscript.json` を開き、中身を `src/appsscript.json` の内容に置き換えて保存します。
   - ※ この手順は任意です。既定のマニフェストのままでも動作します（OAuthスコープは初回実行時に自動要求）。
   - （`clasp` を使う場合は、上記2・3は不要で `src` ディレクトリをそのまま push してください。）
4. 認証情報を **スクリプト プロパティに手動登録**します。
   - Apps Script エディタ左メニューの **プロジェクトの設定（歯車アイコン）** を開きます。
   - 一番下の **「スクリプト プロパティ」** で「スクリプト プロパティを追加」を押し、以下の2つを登録して保存します。

     | プロパティ | 値 |
     | --- | --- |
     | `ADMINA_API_TOKEN` | APIトークン |
     | `ADMINA_ORGANIZATION_ID` | organizationId（例: `123456`） |

5. スプレッドシートを再読み込みすると、メニューに **「Admina」** が追加されます。
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
