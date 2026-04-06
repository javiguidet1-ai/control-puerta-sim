const BASE = '/';

function getToken() {
  return localStorage.getItem('pl_token') || '';
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('pl_token');
    window.location.href = '/login';
    throw new Error('Sesión expirada');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── Auth ────────────────────────────────────────────────────────────────────
export const auth = {
  login: (username, password) =>
    request('POST', '/auth/login', { username, password }),
  verify: () =>
    request('POST', '/auth/verify'),
};

// ─── Casilleros ───────────────────────────────────────────────────────────────
export const casilleros = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    ).toString();
    return request('GET', `/casilleros${qs ? `?${qs}` : ''}`);
  },
  get: (id) => request('GET', `/casilleros/${id}`),
  update: (id, data) => request('PUT', `/casilleros/${id}`, data),
  reenviarPuerta: (id) => request('POST', `/casilleros/${id}/reenviar-puerta`),
  exportCsv: (estado) => {
    const token = getToken();
    const qs = estado ? `?estado=${estado}` : '';
    const url = `/casilleros/export/csv${qs}`;
    const a = document.createElement('a');
    a.href = url + (url.includes('?') ? '&' : '?') + `_token=${token}`;
    // Para el export usamos fetch directamente
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'casilleros_puerta_lobres.csv';
        link.click();
      });
  },
};

// ─── SMS ─────────────────────────────────────────────────────────────────────
export const sms = {
  enviar: (to, message, id_casillero) =>
    request('POST', '/sms/enviar', { to, message, id_casillero }),
  enviarAlta: (id) =>
    request('POST', `/sms/enviar-alta/${id}`),
  registro: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    ).toString();
    return request('GET', `/sms/registro${qs ? `?${qs}` : ''}`);
  },
  pendientes: () => request('GET', '/sms/pendientes'),
};

// ─── Auditoría ───────────────────────────────────────────────────────────────
export const auditoria = {
  lista: () => request('GET', '/auditoria/lista'),
  log: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    ).toString();
    return request('GET', `/auditoria/log${qs ? `?${qs}` : ''}`);
  },
  stats: () => request('GET', '/auditoria/stats'),
};

// ─── Configuración ────────────────────────────────────────────────────────────
export const config = {
  get: () => request('GET', '/config'),
  update: (data) => request('PUT', '/config', data),
  testSms: (to) => request('POST', '/config/test-sms', { to }),
};
