/**
 * CustomWorkspace.gs
 * スプレッドシートからの一括作成と、スプレッドシートUI（メニュー）。
 *
 * シート構成（1行目=ヘッダー、2行目以降=データ）:
 *   A: serviceId            （必須）作成元のサービスID
 *   B: workspaceName        （必須）ワークスペース名
 *   C: customWorkspaceType  （必須）google_sheet または manual_import
 *   D: status               （出力）成功 / 失敗 / スキップ
 *   E: workspaceId          （出力）作成されたワークスペースID
 *   F: message              （出力）エラーメッセージ等
 *   G: processedAt          （出力）処理日時
 */

const HEADER_ROW = [
  'serviceId',
  'workspaceName',
  'customWorkspaceType',
  'status',
  'workspaceId',
  'message',
  'processedAt'
];

const COL = {
  SERVICE_ID: 1,
  WORKSPACE_NAME: 2,
  CUSTOM_TYPE: 3,
  STATUS: 4,
  WORKSPACE_ID: 5,
  MESSAGE: 6,
  PROCESSED_AT: 7
};

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
    .addSeparator()
    .addItem('カスタムアプリを一括作成', 'createWorkspacesFromSheet')
    .toUi();
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

    const serviceId = row[COL.SERVICE_ID - 1];
    const workspaceName = row[COL.WORKSPACE_NAME - 1];
    const customType = row[COL.CUSTOM_TYPE - 1];
    const currentStatus = row[COL.STATUS - 1];

    // 空行はスキップ
    if (serviceId === '' && workspaceName === '' && customType === '') {
      continue;
    }

    // 作成済みの行は再実行しない
    if (currentStatus === STATUS_SUCCESS) {
      skipCount++;
      continue;
    }

    const now = new Date();
    try {
      const result = createCustomWorkspace(serviceId, workspaceName, customType);

      if (result.ok) {
        const workspace = (result.body && result.body.workspace) || {};
        writeResult_(sheet, rowIndex, STATUS_SUCCESS, workspace.id || '', '', now);
        successCount++;
      } else {
        const message = extractErrorMessage_(result);
        writeResult_(sheet, rowIndex, STATUS_FAILED, '', 'HTTP ' + result.status + ': ' + message, now);
        failCount++;
      }
    } catch (e) {
      writeResult_(sheet, rowIndex, STATUS_FAILED, '', String(e && e.message ? e.message : e), now);
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
function writeResult_(sheet, rowIndex, status, workspaceId, message, processedAt) {
  sheet.getRange(rowIndex, COL.STATUS).setValue(status);
  sheet.getRange(rowIndex, COL.WORKSPACE_ID).setValue(workspaceId);
  sheet.getRange(rowIndex, COL.MESSAGE).setValue(message);
  sheet.getRange(rowIndex, COL.PROCESSED_AT).setValue(
    Utilities.formatDate(processedAt, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
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
