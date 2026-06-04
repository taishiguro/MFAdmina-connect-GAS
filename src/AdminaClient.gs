/**
 * AdminaClient.gs
 * マネーフォワード Admina Public API の呼び出しラッパー。
 */

/**
 * カスタムワークスペース（カスタムアプリ）を作成する。
 *
 * POST /organizations/{organizationId}/workspaces/custom
 *
 * 公式ドキュメント（API Reference）の Body Params に準拠し、以下の3項目を送信する。
 *   - serviceId           : 組織に属する標準サービスID または カスタムサービスID（必須）
 *   - workspaceName       : ワークスペース名（必須）
 *   - customWorkspaceType : 'google_sheet' または 'manual_import'（必須）
 *
 * @param {Object} params
 * @param {(number|string)} params.serviceId           対象サービスのID（必須）
 * @param {string}          params.workspaceName        ワークスペース名（必須）
 * @param {string}          params.customWorkspaceType  'google_sheet' または 'manual_import'（必須）
 * @return {{ok: boolean, status: number, body: Object}} 結果オブジェクト
 */
function createCustomWorkspace(params) {
  params = params || {};
  const serviceId = params.serviceId;
  const workspaceName = params.workspaceName;
  const customWorkspaceType = params.customWorkspaceType;

  // --- 入力チェック ---
  if (serviceId === undefined || serviceId === null || String(serviceId).trim() === '') {
    throw new Error('serviceId は必須です。');
  }
  if (!workspaceName || String(workspaceName).trim() === '') {
    throw new Error('workspaceName は必須です。');
  }
  if (ALLOWED_CUSTOM_WORKSPACE_TYPES.indexOf(customWorkspaceType) === -1) {
    throw new Error(
      'customWorkspaceType は ' + ALLOWED_CUSTOM_WORKSPACE_TYPES.join(' / ') + ' のいずれかです。' +
      ' 指定値: ' + customWorkspaceType
    );
  }

  const organizationId = getOrganizationId_();
  const url = ADMINA_API_BASE_URL +
    '/organizations/' + encodeURIComponent(organizationId) + '/workspaces/custom';

  const payload = {
    serviceId: Number(serviceId),
    workspaceName: String(workspaceName).trim(),
    customWorkspaceType: customWorkspaceType
  };

  const response = adminaFetch_('post', url, payload);
  return response;
}

/**
 * 組織に属するサービス一覧を取得する（serviceId を調べる用途）。
 *
 * GET /organizations/{organizationId}/services
 *
 * @return {{ok: boolean, status: number, body: Object}}
 */
function fetchServices() {
  const organizationId = getOrganizationId_();
  const url = ADMINA_API_BASE_URL +
    '/organizations/' + encodeURIComponent(organizationId) + '/services';
  return adminaFetch_('get', url, null);
}

/**
 * サービス一覧APIのレスポンスをそのままログに出力する（診断用）。
 * Apps Script エディタでこの関数を選んで「実行」し、「実行ログ」を確認する。
 */
function diagnoseServices() {
  const organizationId = getOrganizationId_();
  const url = ADMINA_API_BASE_URL +
    '/organizations/' + encodeURIComponent(organizationId) + '/services';
  Logger.log('===== サービス一覧診断 =====');
  Logger.log('リクエストURL: ' + url);
  const result = adminaFetch_('get', url, null);
  Logger.log('HTTP ステータス: ' + result.status);
  Logger.log('レスポンスボディ（先頭1000文字）:');
  Logger.log(JSON.stringify(result.body).substring(0, 1000));
}

/**
 * Admina API への共通リクエスト処理。
 * Bearer 認証を付与し、レスポンスを解析して返す（例外を投げずに結果を返す）。
 *
 * @param {string}  method   'get' | 'post' など
 * @param {string}  url      フルURL
 * @param {?Object} payload  JSONボディ（無い場合は null）
 * @return {{ok: boolean, status: number, body: Object}}
 */
function adminaFetch_(method, url, payload) {
  const options = {
    method: method,
    contentType: 'application/json',
    headers: {
      accept: 'application/json',
      Authorization: 'Bearer ' + getApiToken_()
    },
    muteHttpExceptions: true // 4xx/5xx でも例外を投げず、ステータスを自前で判定する
  };
  if (payload) {
    options.payload = JSON.stringify(payload);
  }

  const httpResponse = UrlFetchApp.fetch(url, options);
  const status = httpResponse.getResponseCode();
  const text = httpResponse.getContentText();

  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch (e) {
    body = { raw: text };
  }

  return {
    ok: status >= 200 && status < 300,
    status: status,
    body: body
  };
}

/**
 * 認証の疎通確認（診断用）。
 * エディタでこの関数を選んで「実行」し、上部の「実行ログ」を確認する。
 * トークン / organizationId のどちらに問題があるかを切り分ける。
 *
 * 判定の目安:
 *   - GET が 401  → トークンが無効、または別組織のトークン（要再発行・確認）
 *   - GET が 200/403/404 → トークン自体は有効（401は作成APIのボディ/権限側を疑う）
 */
function diagnoseAuth() {
  const props = PropertiesService.getScriptProperties();
  const rawToken = props.getProperty(PROP_KEY_API_TOKEN);
  const rawOrgId = props.getProperty(PROP_KEY_ORGANIZATION_ID);

  Logger.log('===== Admina 認証診断 =====');
  Logger.log('organizationId: ' + (rawOrgId || '(未設定)'));

  if (!rawToken) {
    Logger.log('APIトークン: (未設定) ← スクリプトプロパティ ' + PROP_KEY_API_TOKEN + ' を登録してください');
    return;
  }
  Logger.log('トークン文字数: ' + rawToken.length);
  Logger.log('前後に空白/改行あり: ' + (rawToken !== rawToken.trim()));
  Logger.log('トークン先頭/末尾: ' +
    rawToken.trim().substring(0, 4) + '…' + rawToken.trim().slice(-4));

  // 読み取り系エンドポイントで疎通確認（GET）
  const url = ADMINA_API_BASE_URL +
    '/organizations/' + encodeURIComponent(String(rawOrgId).trim()) + '/workspaces';
  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { accept: 'application/json', Authorization: 'Bearer ' + rawToken.trim() },
    muteHttpExceptions: true
  });
  Logger.log('----- 疎通テスト GET ' + url + ' -----');
  Logger.log('HTTP ' + res.getResponseCode());
  Logger.log((res.getContentText() || '').substring(0, 300));
}
