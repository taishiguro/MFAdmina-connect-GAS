/**
 * AdminaClient.gs
 * マネーフォワード Admina Public API の呼び出しラッパー。
 */

/**
 * カスタムワークスペース（カスタムアプリ）を作成する。
 *
 * POST /organizations/{organizationId}/workspaces/custom
 *
 * サービスの指定方法は2通り（どちらか必須）:
 *   - serviceId   : 既存の標準/カスタムサービスIDを指定して、その配下にワークスペースを作成
 *   - serviceName : 新規にカスタムサービスを作成して、その配下にワークスペースを作成
 *
 * 任意項目（serviceUrl / serviceMasterName）は、値が入っている場合のみ送信する。
 *
 * @param {Object} params
 * @param {(number|string)} [params.serviceId]          既存サービスID（serviceName と排他・いずれか必須）
 * @param {string}          [params.serviceName]        新規カスタムサービス名（serviceId と排他・いずれか必須）
 * @param {string}          [params.serviceUrl]         カスタムサービスのURL（任意）
 * @param {string}          [params.serviceMasterName]  サービスマスター名（任意）
 * @param {string}          params.workspaceName        ワークスペース名（必須）
 * @param {string}          params.customWorkspaceType  'google_sheet' または 'manual_import'（必須）
 * @return {{ok: boolean, status: number, body: Object}} 結果オブジェクト
 */
function createCustomWorkspace(params) {
  params = params || {};
  const serviceId = params.serviceId;
  const serviceName = params.serviceName;
  const serviceUrl = params.serviceUrl;
  const serviceMasterName = params.serviceMasterName;
  const workspaceName = params.workspaceName;
  const customWorkspaceType = params.customWorkspaceType;

  // --- 入力チェック ---
  const hasServiceId = !(serviceId === undefined || serviceId === null || String(serviceId).trim() === '');
  const hasServiceName = !!(serviceName && String(serviceName).trim() !== '');
  if (!hasServiceId && !hasServiceName) {
    throw new Error('serviceId または serviceName のいずれかは必須です。');
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

  // --- ペイロード組み立て（任意項目は値があるときだけ含める） ---
  const payload = {
    workspaceName: String(workspaceName).trim(),
    customWorkspaceType: customWorkspaceType
  };
  if (hasServiceId) {
    payload.serviceId = Number(serviceId);
  }
  if (hasServiceName) {
    payload.serviceName = String(serviceName).trim();
  }
  if (serviceUrl && String(serviceUrl).trim() !== '') {
    payload.serviceUrl = String(serviceUrl).trim();
  }
  if (serviceMasterName && String(serviceMasterName).trim() !== '') {
    payload.serviceMasterName = String(serviceMasterName).trim();
  }

  const response = adminaFetch_('post', url, payload);
  return response;
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
