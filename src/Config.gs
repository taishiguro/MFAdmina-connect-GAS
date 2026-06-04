/**
 * Config.gs
 * 設定値とスクリプトプロパティ（認証情報）の管理。
 *
 * APIトークンと organizationId は、コードに直書きせず
 * スクリプトプロパティに保持します。
 *
 * 【初回セットアップ（手動登録）】
 * Apps Script エディタの左メニュー「プロジェクトの設定（歯車アイコン）」を開き、
 * 一番下の「スクリプト プロパティ」で以下の2つを追加してください。
 *
 *   プロパティ              値
 *   --------------------  -----------------------------
 *   ADMINA_API_TOKEN      （APIトークン）
 *   ADMINA_ORGANIZATION_ID（organizationId。例: 123456）
 *
 * 「スクリプト プロパティを追加」→ プロパティ名と値を入力 →「スクリプトのプロパティを保存」。
 * コードの編集・実行は不要です。
 */

// ===== 定数 =====

/** Admina API のベースURL */
const ADMINA_API_BASE_URL = 'https://api.itmc.i.moneyforward.com/api/v1';

/** スクリプトプロパティのキー名 */
const PROP_KEY_API_TOKEN = 'ADMINA_API_TOKEN';
const PROP_KEY_ORGANIZATION_ID = 'ADMINA_ORGANIZATION_ID';

/** 一括作成に使用するシート名 */
const SHEET_NAME = 'CustomWorkspaces';

/** customWorkspaceType に指定できる値（APIの enum） */
const ALLOWED_CUSTOM_WORKSPACE_TYPES = ['google_sheet', 'manual_import'];

// ===== 認証情報の取得 =====

/**
 * 保存済みのAPIトークンを取得する。
 * @return {string}
 */
function getApiToken_() {
  const token = PropertiesService.getScriptProperties().getProperty(PROP_KEY_API_TOKEN);
  if (!token) {
    throw new Error(
      'APIトークンが未設定です。プロジェクトの設定 →「スクリプト プロパティ」で ' +
      PROP_KEY_API_TOKEN + ' を登録してください。'
    );
  }
  return token.trim(); // コピペ時に混入しがちな前後の空白・改行を除去
}

/**
 * 保存済みの organizationId を取得する。
 * @return {string}
 */
function getOrganizationId_() {
  const orgId = PropertiesService.getScriptProperties().getProperty(PROP_KEY_ORGANIZATION_ID);
  if (!orgId) {
    throw new Error(
      'organizationId が未設定です。プロジェクトの設定 →「スクリプト プロパティ」で ' +
      PROP_KEY_ORGANIZATION_ID + ' を登録してください。'
    );
  }
  return String(orgId).trim();
}
