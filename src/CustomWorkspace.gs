/**
 * CustomWorkspace.gs
 * スプレッドシートからの一括作成と、スプレッドシートUI（メニュー）。
 *
 * シート構成（1行目=ヘッダー、2行目以降=データ）:
 *   --- 入力 ---
 *   A: serviceId            （必須）対象サービスのID（標準/カスタム）
 *   B: workspaceName        （必須）ワークスペース名
 *   C: customWorkspaceType  （必須）google_sheet または manual_import
 *   --- 出力 ---
 *   D: status               成功 / 失敗 / スキップ
 *   E: resultServiceId      作成または使用されたサービスID
 *   F: isNewService         true なら新規サービスとして登録された
 *   G: workspaceId          作成されたワークスペースID
 *   H: message              エラーメッセージ等
 *   I: processedAt          処理日時
 *
 * serviceId が分からない場合は、メニュー「Admina → サービス一覧を取得」で
 * 「Services」シートに id と名前を出力できます。
 */

const HEADER_ROW = [
  'serviceId',
  'workspaceName',
  'customWorkspaceType',
  'status',
  'resultServiceId',
  'isNewService',
  'workspaceId',
  'message',
  'processedAt'
];

const COL = {
  SERVICE_ID: 1,
  WORKSPACE_NAME: 2,
  CUSTOM_TYPE: 3,
  STATUS: 4,
  RESULT_SERVICE_ID: 5,
  IS_NEW_SERVICE: 6,
  WORKSPACE_ID: 7,
  MESSAGE: 8,
  PROCESSED_AT: 9
};

/** サービス一覧の出力先シート名 */
const SERVICES_SHEET_NAME = 'Services';

const STATUS_SUCCESS = '成功';
const STATUS_FAILED = '失敗';
const STATUS_SKIPPED = 'スキップ';

/**
 * スプレッドシートを開いたときにカスタムメニューを追加する。
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Admina')
    .addItem('入力シートを準備', 'setupSheet')
    .addItem('サービス一覧を取得', 'listServicesToSheet')
    .addSeparator()
    .addItem('カスタムアプリを一括作成', 'createWorkspacesFromSheet')
    .addToUi();
}

/**
 * 入力用シートを作成（または初期化）してヘッダーを書き込む。
 */
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  sheet.getRange(1, 1, 1, HEADER_ROW.length).setValues([HEADER_ROW])
    .setFontWeight('bold')
    .setBackground('#f1f3f4');
  sheet.setFrozenRows(1);

  // ヘッダーに入力ガイドのメモを付与
  sheet.getRange(1, COL.SERVICE_ID).setNote(
    '対象サービスのID（必須）。「サービス一覧を取得」で確認できます。'
  );
  sheet.getRange(1, COL.WORKSPACE_NAME).setNote('ワークスペース名（必須）。');
  sheet.getRange(1, COL.CUSTOM_TYPE).setNote('google_sheet または manual_import（必須）。');

  // customWorkspaceType 列にプルダウンを設定
  const typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(ALLOWED_CUSTOM_WORKSPACE_TYPES, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, COL.CUSTOM_TYPE, sheet.getMaxRows() - 1, 1).setDataValidation(typeRule);

  sheet.autoResizeColumns(1, HEADER_ROW.length);
  SpreadsheetApp.getActiveSpreadsheet().toast('シート「' + SHEET_NAME + '」を準備しました。');
}

/**
 * シートの各行を読み取り、カスタムワークスペースを一括作成する。
 * すでに「成功」になっている行は二重作成を防ぐためスキップする。
 */
function createWorkspacesFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    SpreadsheetApp.getUi().alert(
      'シート「' + SHEET_NAME + '」が見つかりません。先に「入力シートを準備」を実行してください。'
    );
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('データ行がありません。2行目以降に入力してください。');
    return;
  }

  const numRows = lastRow - 1;
  const values = sheet.getRange(2, 1, numRows, HEADER_ROW.length).getValues();

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowIndex = i + 2; // 実際のシート行番号

    const params = {
      serviceId: row[COL.SERVICE_ID - 1],
      workspaceName: row[COL.WORKSPACE_NAME - 1],
      customWorkspaceType: row[COL.CUSTOM_TYPE - 1]
    };
    const currentStatus = row[COL.STATUS - 1];

    // 入力列がすべて空の行はスキップ
    const allEmpty = [
      params.serviceId, params.workspaceName, params.customWorkspaceType
    ].every(function (v) { return v === '' || v === null || v === undefined; });
    if (allEmpty) {
      continue;
    }

    // 作成済みの行は再実行しない
    if (currentStatus === STATUS_SUCCESS) {
      skipCount++;
      continue;
    }

    const now = new Date();
    try {
      const result = createCustomWorkspace(params);

      if (result.ok) {
        const body = result.body || {};
        const workspace = body.workspace || {};
        const service = body.service || workspace.service || {};
        const isNew = body.isNewService === undefined ? '' : body.isNewService;
        writeResult_(sheet, rowIndex, STATUS_SUCCESS, service.id || '', isNew, workspace.id || '', '', now);
        successCount++;
      } else {
        const message = extractErrorMessage_(result);
        writeResult_(sheet, rowIndex, STATUS_FAILED, '', '', '', 'HTTP ' + result.status + ': ' + message, now);
        failCount++;
      }
    } catch (e) {
      writeResult_(sheet, rowIndex, STATUS_FAILED, '', '', '', String(e && e.message ? e.message : e), now);
      failCount++;
    }

    // レート制限への配慮（必要に応じて調整）
    Utilities.sleep(300);
  }

  SpreadsheetApp.getActiveSpreadsheet().toast(
    '完了: 成功 ' + successCount + ' / 失敗 ' + failCount + ' / スキップ ' + skipCount,
    'Admina 一括作成',
    10
  );
}

/**
 * 1行分の結果をシートに書き込む。
 */
function writeResult_(sheet, rowIndex, status, resultServiceId, isNewService, workspaceId, message, processedAt) {
  sheet.getRange(rowIndex, COL.STATUS).setValue(status);
  sheet.getRange(rowIndex, COL.RESULT_SERVICE_ID).setValue(resultServiceId);
  sheet.getRange(rowIndex, COL.IS_NEW_SERVICE).setValue(isNewService);
  sheet.getRange(rowIndex, COL.WORKSPACE_ID).setValue(workspaceId);
  sheet.getRange(rowIndex, COL.MESSAGE).setValue(message);
  sheet.getRange(rowIndex, COL.PROCESSED_AT).setValue(
    Utilities.formatDate(processedAt, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
  );
}

/**
 * 組織のサービス一覧を取得し、「Services」シートに id と名前を書き出す。
 * 作成時に指定する serviceId を調べる用途。
 */
function listServicesToSheet() {
  const result = fetchServices();
  if (!result.ok) {
    SpreadsheetApp.getUi().alert(
      'サービス一覧の取得に失敗しました。\nHTTP ' + result.status + ': ' + extractErrorMessage_(result)
    );
    return;
  }

  // レスポンスが配列／{services:[...]}／{data:[...]} のいずれでも拾えるようにする
  const body = result.body;
  let services = [];
  if (Array.isArray(body)) {
    services = body;
  } else if (body && Array.isArray(body.services)) {
    services = body.services;
  } else if (body && Array.isArray(body.data)) {
    services = body.data;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SERVICES_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SERVICES_SHEET_NAME);
  }
  sheet.clear();

  const header = ['serviceId', 'name', 'uniqueName', 'isCustomService'];
  sheet.getRange(1, 1, 1, header.length).setValues([header])
    .setFontWeight('bold')
    .setBackground('#f1f3f4');
  sheet.setFrozenRows(1);

  if (services.length === 0) {
    SpreadsheetApp.getUi().alert(
      'サービスは0件、または想定外のレスポンス形式でした。\n\n' +
      'レスポンス形式を確認するには、Apps Script エディタで\n' +
      '「diagnoseServices」関数を実行して実行ログを確認してください。\n\n' +
      '生レスポンス（先頭500文字）:\n' +
      JSON.stringify(body).substring(0, 500)
    );
    return;
  }

  const rows = services.map(function (s) {
    s = s || {};
    return [
      s.id !== undefined ? s.id : '',
      s.name || '',
      s.uniqueName || '',
      s.isCustomService === undefined ? '' : s.isCustomService
    ];
  });
  sheet.getRange(2, 1, rows.length, header.length).setValues(rows);
  sheet.autoResizeColumns(1, header.length);

  SpreadsheetApp.getActiveSpreadsheet().toast(
    services.length + ' 件のサービスを「' + SERVICES_SHEET_NAME + '」シートに出力しました。',
    'Admina', 8
  );
}

/**
 * APIエラーレスポンスから、できるだけ分かりやすいメッセージを取り出す。
 */
function extractErrorMessage_(result) {
  const body = result.body || {};
  if (typeof body.message === 'string') return body.message;
  if (body.error && typeof body.error.message === 'string') return body.error.message;
  if (typeof body.error === 'string') return body.error;
  return JSON.stringify(body);
}
