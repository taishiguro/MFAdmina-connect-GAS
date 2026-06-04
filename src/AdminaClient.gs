/**
 * AdminaClient.gs
 * マネーフォワード Admina Public API の呼び出しラッパー。
 */

/**
 * カスタムワークスペース（カスタムアプリ）を作成する。
 *
 * POST /organizations/{organizationId}/workspaces/custom
 *
 * @param {(number|string)} serviceId          標準サービスID、または組織に属するカスタムサービスID（必須）
 * @param {string}          workspaceName        ワークスペースに付ける名前（必須）
 * @param {string}          customWorkspaceType  'google_sheet' または 'manual_import'（必須）
 * @return {{ok: boolean, status: number, body: Object}} 結果オブジェクト
 */
function createCustomWorkspace(serviceId, workspaceName, customWorkspaceType) {
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
