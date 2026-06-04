# MFAdmina-connect-GAS

マネーフォワード Admina の Public API を使って、**カスタムアプリ（カスタムワークスペース）を作成する** Google Apps Script (GAS) です。
Google スプレッドシートに作成情報を並べて、メニューから一括作成できます。

## 使用するAPI

`POST https://api.itmc.i.moneyforward.com/api/v1/organizations/{organizationId}/workspaces/custom`

| 項目 | 内容 |
| --- | --- |
| 認証 | Bearer トークン |
| パスパラメータ | `organizationId`（必須） |
| ボディ（必須） | `workspaceName`, `customWorkspaceType`（`google_sheet` / `manual_import`）、および `serviceId` か `serviceName` のいずれか |
| ボディ（任意） | `serviceUrl`, `serviceMasterName` |
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

   ### 入力列

   | 列 | 項目 | 必須 | 説明 |
   | --- | --- | --- | --- |
   | A | `serviceId` | ※ | 既存の標準/カスタムサービスID（`serviceName` と排他） |
   | B | `serviceName` | ※ | 新規カスタムサービスを作成する場合の名前（`serviceId` 未指定時） |
   | C | `serviceUrl` | 任意 | カスタムサービスのURL |
   | D | `serviceMasterName` | 任意 | サービスマスター名 |
   | E | `workspaceName` | 必須 | ワークスペース名 |
   | F | `customWorkspaceType` | 必須 | `google_sheet` / `manual_import` |

   ※ `serviceId` か `serviceName` の **どちらか一方は必須** です。

   ### 出力列（実行後に自動入力）

   | 列 | 項目 | 説明 |
   | --- | --- | --- |
   | G | `status` | 成功 / 失敗 / スキップ |
   | H | `resultServiceId` | 作成または使用されたサービスID |
   | I | `workspaceId` | 作成されたワークスペースID |
   | J | `message` | エラーメッセージ等 |
   | K | `processedAt` | 処理日時 |

   #### 入力例

   | serviceId | serviceName | serviceUrl | serviceMasterName | workspaceName | customWorkspaceType |
   | --- | --- | --- | --- | --- | --- |
   | 1 | | | | 営業部 経費スプレッドシート | google_sheet |
   | | 自社内製ツール | https://example.com | | 手動取込アプリ | manual_import |

3. メニュー **Admina → カスタムアプリを一括作成** を実行します。
4. 各行の出力列（`status` ほか）に結果が書き込まれます。
   - `status` が `成功` の行は、再実行しても二重作成されないようスキップされます。
   - 任意項目（`serviceUrl` / `serviceMasterName`）は、値が入っている行だけ送信されます。

## 単体で呼び出す場合

スプレッドシートを使わずに関数を直接呼ぶこともできます。引数はオブジェクトで渡します。

```javascript
function example() {
  // 既存サービスIDを使う場合
  const result = createCustomWorkspace({
    serviceId: 1,
    workspaceName: 'テストアプリ',
    customWorkspaceType: 'google_sheet'
  });
  Logger.log(result.status); // 201
  Logger.log(result.body.workspace.id);

  // 新規カスタムサービスを作成する場合
  createCustomWorkspace({
    serviceName: '自社内製ツール',
    serviceUrl: 'https://example.com',
    workspaceName: '手動取込アプリ',
    customWorkspaceType: 'manual_import'
  });
}
```

## 注意事項

- APIトークンはコードに直書きせず、スクリプトプロパティに保持しています。リポジトリにトークンをコミットしないでください。
- サービスの指定は `serviceId`（既存サービス）か `serviceName`（新規カスタムサービス作成）の **どちらか一方** を使います。
- 大量に作成する場合、レート制限に配慮して各リクエスト間に約0.3秒の待機を入れています（`CustomWorkspace.gs` で調整可能）。
