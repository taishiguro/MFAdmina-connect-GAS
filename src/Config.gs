/**
 * Config.gs
 * 設定値とスクリプトプロパティ（認証情報）の管理。
 *
 * APIトークンと organizationId は、コードに直書きせず
 * スクリプトプロパティに保持します。
 * 初回は setupCredentials() を実行して値を保存してください。
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

// ===== 認証情報の保存 / 取得 =====

/**
 * 初回セットアップ用。
 * 下の値を自分の環境に合わせて書き換えてから、この関数を1度だけ実行してください。
 * 実行後はトークンが残らないよう、値を消しておくことを推奨します。
 */
function setupCredentials() {
  const apiToken = 'ここにAPIトークンを貼り付け';
  const organizationId = 'ここにorganizationIdを入力'; // 例: '123456'

  if (apiToken === 'ここにAPIトークンを貼り付け' || !apiToken) {
    throw new Error('setupCredentials(): apiToken を設定してください。');
  }
  if (organizationId === 'ここにorganizationIdを入力' || !organizationId) {
    throw new Error('setupCredentials(): organizationId を設定してください。');
  }

  const props = PropertiesService.getScriptProperties();
  props.setProperty(PROP_KEY_API_TOKEN, String(apiToken).trim());
  props.setProperty(PROP_KEY_ORGANIZATION_ID, String(organizationId).trim());

  Logger.log('認証情報を保存しました。セキュリティのため、この関数内の値は消去してください。');
}

/**
 * 保存済みのAPIトークンを取得する。
 * @return {string}
 */
function getApiToken_() {
  const token = PropertiesService.getScriptProperties().getProperty(PROP_KEY_API_TOKEN);
  if (!token) {
    throw new Error('APIトークンが未設定です。先に setupCredentials() を実行してください。');
  }
  return token;
}

/**
 * 保存済みの organizationId を取得する。
 * @return {string}
 */
function getOrganizationId_() {
  const orgId = PropertiesService.getScriptProperties().getProperty(PROP_KEY_ORGANIZATION_ID);
  if (!orgId) {
    throw new Error('organizationId が未設定です。先に setupCredentials() を実行してください。');
  }
  return orgId;
}
