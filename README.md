# MFAdmina-connect-GAS

マネーフォワード Admina の Public API を使って、**カスタムアプリ（カスタムワークスペース）を作成する** Google Apps Script (GAS) です。
Google スプレッドシートに作成情報を並べて、メニューから一括作成できます。

## 使用するAPI

`POST https://api.itmc.i.moneyforward.com/api/v1/organizations/{organizationId}/workspaces/custom`

| 項目 | 内容 |
| --- | --- |
| 認証 | Bearer トークン |
| パスパラメータ | `organizationId`（必須） |
| ボディ（必須） | `serviceId`, `workspaceName`, `customWorkspaceType`（`google_sheet` / `manual_import`） |
| 成功レスポンス | `201`（`service` / `workspace` / `isNewService` を含む） |

> ボディは公式 API Reference の Body Params に準拠しています（`serviceId` は必須）。

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
2. （`serviceId` が分からない場合）メニュー **Admina → サービス一覧を取得** を実行すると、`Services` シートに各サービスの `serviceId` / `name` が出力されます。ここから対象の `serviceId` を確認します。
3. `CustomWorkspaces` シートの2行目以降に作成したいカスタムアプリを入力します。

   ### 入力列

   | 列 | 項目 | 必須 | 説明 |
   | --- | --- | --- | --- |
   | A | `serviceId` / `serviceMasterName` | 必須 | **数値**を入力すると既存サービスID（`serviceId`）として送信。**文字列**（例: `Tailscale`）を入力するとAdminaマスター名（`serviceMasterName`）として送信し、未接続サービスを新規登録できる |
   | B | `workspaceName` | 必須 | ワークスペース名 |
   | C | `customWorkspaceType` | 必須 | `google_sheet` / `manual_import` |

   ### 出力列（実行後に自動入力）

   | 列 | 項目 | 説明 |
   | --- | --- | --- |
   | D | `status` | 成功 / 失敗 / スキップ |
   | E | `resultServiceId` | 作成または使用されたサービスID |
   | F | `isNewService` | `true` なら新規サービスとして登録された |
   | G | `workspaceId` | 作成されたワークスペースID |
   | H | `message` | エラーメッセージ等 |
   | I | `processedAt` | 処理日時 |

   #### 入力例

   | serviceId | workspaceName | customWorkspaceType |
   | --- | --- | --- |
   | 1 | 営業部 経費スプレッドシート | google_sheet |
   | 20 | 手動取込アプリ | manual_import |

4. メニュー **Admina → カスタムアプリを一括作成** を実行します。
5. 各行の出力列（`status` ほか）に結果が書き込まれます。
   - `status` が `成功` の行は、再実行しても二重作成されないようスキップされます。
   - `isNewService` が `true` の場合、その `serviceId` のサービスが（組織に未登録だったため）新規登録されたことを表します。

## 新規サービスの登録について

このAPIは入力の種類に応じて3つのパターンを受け付けます。

| パターン | A列の入力 | 送信フィールド | 用途 |
| --- | --- | --- | --- |
| ① | 数値（例: `1`） | `serviceId` | 組織に既存のサービスへのワークスペース追加 |
| ② | 文字列（例: `Tailscale`） | `serviceMasterName` | Adminaマスター上にある未接続サービスを組織に新規登録しつつ作成 |

- ②で作成に成功すると、組織にそのサービスが追加され、出力の `isNewService` が `true` になります。
- Adminaマスターに存在しない完全カスタムサービスの作成は、このスクリプトでは現在非対応です。

## 単体で呼び出す場合

スプレッドシートを使わずに関数を直接呼ぶこともできます。引数はオブジェクトで渡します。

```javascript
function example() {
  const result = createCustomWorkspace({
    serviceId: 1,
    workspaceName: 'テストアプリ',
    customWorkspaceType: 'google_sheet'
  });
  Logger.log(result.status); // 201
  Logger.log(result.body.workspace.id);
}
```

## トラブルシューティング

### `HTTP 401: unauthorized` が出る

認証（Bearer トークン）が拒否されています。次の手順で切り分けます。

1. Apps Script エディタで関数 **`diagnoseAuth`** を選んで「実行」し、上部の **「実行ログ」** を確認します。
   - 疎通テスト（GET）が **401** → トークンが無効、または別組織のトークンです。トークンを再発行・確認してください。
   - GET が **200 / 403 / 404** → トークン自体は有効です。作成APIのボディや権限側を確認します。
2. ログに「前後に空白/改行あり: true」と出たら、スクリプト プロパティの `ADMINA_API_TOKEN` を空白なしで登録し直します（取得時に自動で `trim()` もしています）。
3. `organizationId`（例: `99582691`）がトークンを発行した組織と一致しているか確認します。

### `HTTP 400: bad_request` が出る

リクエストボディが不正です。多くは **`serviceId` の指定漏れ** が原因です。

1. `serviceId` 列が空でないか確認します（このエンドポイントでは必須）。
2. `serviceId` が分からない場合は、メニュー **Admina → サービス一覧を取得** で `Services` シートを出力し、対象の `serviceId` を確認します。
3. `customWorkspaceType` が `google_sheet` / `manual_import` のいずれかになっているか確認します。

## 注意事項

- APIトークンはコードに直書きせず、スクリプトプロパティに保持しています。リポジトリにトークンをコミットしないでください。
- このエンドポイントのボディは公式 API Reference に準拠し、`serviceId`（必須）で対象サービスを指定します。
- 大量に作成する場合、レート制限に配慮して各リクエスト間に約0.3秒の待機を入れています（`CustomWorkspace.gs` で調整可能）。
