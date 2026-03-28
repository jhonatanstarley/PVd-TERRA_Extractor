// ═══════════════════════════════════════════════════════
//  PVdōTERRA Extractor — Popup Script
// ═══════════════════════════════════════════════════════

let selectedFmt = 'csv';
let extractedOrders = [];
let extractedConsultant = null;
let currentTabId = null;

// Escuta progresso do content script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'progress') {
    setProgress(msg.percent, msg.message);
  }
});

// INIT
document.addEventListener('DOMContentLoaded', async () => {
  // Wire up buttons via addEventListener (CSP proíbe onclick inline)
  document.getElementById('fmt-json').addEventListener('click', () => selectFmt('json'));
  document.getElementById('fmt-csv').addEventListener('click',  () => selectFmt('csv'));
  document.getElementById('fmt-xml').addEventListener('click',  () => selectFmt('xml'));
  document.getElementById('btn-extract').addEventListener('click', startExtraction);
  document.getElementById('btn-export').addEventListener('click',  exportData);

  selectFmt('csv');
  await checkPage();
});

async function checkPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) { showError('Não foi possível detectar a aba ativa.'); return; }
    currentTabId = tab.id;

    const url = (tab.url || '').toLowerCase();
    const isHistory = url.includes('office.doterra.com') &&
                      (url.includes('orderhistoryfull') || url.includes('orderhistory'));

    if (!isHistory) {
      showNotOnPage();
      return;
    }

    // Confirma com ping ao content script
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      if (resp && resp.ok) {
        showOnPage();
        return;
      }
    } catch(e) {
      // Content script ainda não pronto — injeta manualmente
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        await sleep(300);
        showOnPage();
      } catch(err) {
        showError('Erro ao injetar script: ' + err.message);
      }
      return;
    }

    showOnPage();
  } catch(e) {
    showError('Erro: ' + e.message);
  }
}

function showOnPage() {
  document.getElementById('not-on-page').style.display = 'none';
  document.getElementById('on-page-ui').style.display = 'block';
  setStatus('info', '✅', 'Página detectada! Escolha o formato e clique em Extrair.');
  document.getElementById('btn-extract').disabled = false;
}

function showNotOnPage() {
  document.getElementById('not-on-page').style.display = 'block';
  document.getElementById('on-page-ui').style.display = 'none';
  document.getElementById('status-box').style.display = 'none';
}

function showError(msg) {
  setStatus('err', '❌', msg);
}

// ─── FORMAT ─────────────────────────────────────────────
function selectFmt(fmt) {
  selectedFmt = fmt;
  ['json','csv','xml'].forEach(f => {
    document.getElementById('fmt-' + f).classList.toggle('sel', f === fmt);
  });
}

// ─── EXTRACTION ─────────────────────────────────────────
async function startExtraction() {
  if (!currentTabId) { showError('Aba não identificada.'); return; }

  document.getElementById('btn-extract').disabled = true;
  document.getElementById('btn-export').disabled = true;
  document.getElementById('result-card').style.display = 'none';
  document.getElementById('prog-wrap').style.display = 'block';
  setStatus('info', '⏳', 'Extraindo… Por favor, não feche a aba do doTERRA.');
  setProgress(5, 'Iniciando extração…');

  try {
    const result = await chrome.tabs.sendMessage(currentTabId, {
      action: 'start_extraction',
      format: selectedFmt
    });

    if (result.error) {
      showError('Erro na extração: ' + result.error);
      document.getElementById('btn-extract').disabled = false;
      document.getElementById('prog-wrap').style.display = 'none';
      return;
    }

    extractedOrders = result.orders || [];
    extractedConsultant = result.consultant || { name: 'Consultor', id: '' };
    document.getElementById('result-num').textContent = extractedOrders.length;
    document.getElementById('result-card').style.display = 'block';
    document.getElementById('btn-export').disabled = false;
    document.getElementById('btn-extract').disabled = false;
    document.getElementById('prog-wrap').style.display = 'none';
    setStatus('ok', '✅', `${extractedOrders.length} pedidos extraídos com sucesso! Clique em Baixar Arquivo.`);

  } catch(e) {
    showError('Falha na comunicação: ' + e.message + '. Recarregue a página e tente novamente.');
    document.getElementById('btn-extract').disabled = false;
    document.getElementById('prog-wrap').style.display = 'none';
  }
}

// ─── EXPORT ─────────────────────────────────────────────
async function exportData() {
  if (!extractedOrders.length) { return; }

  let content, mimeType, ext;

  if (selectedFmt === 'json') {
    content = JSON.stringify({ consultant: extractedConsultant, orders: extractedOrders }, null, 2);
    mimeType = 'application/json';
    ext = 'json';
  } else if (selectedFmt === 'csv') {
    content = toCSV(extractedOrders, extractedConsultant);
    mimeType = 'text/csv;charset=utf-8';
    ext = 'csv';
  } else {
    content = toXML(extractedOrders, extractedConsultant);
    mimeType = 'application/xml';
    ext = 'xml';
  }

  const today = new Date().toISOString().slice(0,10);
  const filename = `pvdoterra_pedidos_${today}.${ext}`;

  // Download via URL de blob (injetar na aba ativa)
  await chrome.scripting.executeScript({
    target: { tabId: currentTabId },
    func: downloadBlob,
    args: [content, mimeType, filename]
  });

  setStatus('ok', '📁', `Arquivo "${filename}" baixado com sucesso!`);
}

// Função executada no contexto da página para fazer download
function downloadBlob(content, mimeType, filename) {
  const bom = mimeType.includes('csv') ? '\uFEFF' : '';
  const blob = new Blob([bom + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

// ─── CONVERTERS ─────────────────────────────────────────
function toCSV(orders, consultant) {
  const header = 'id,date,period,pv,valor,frete,recipient,tipo,items,hasLRP,consultant_id,consultant_name';
  const cId = consultant?.id ? `"${consultant.id}"` : '""';
  const cNm = consultant?.name ? `"${consultant.name.replace(/"/g,'""')}"` : '""';
  const rows = orders.map(o => {
    let itemsStr = '';
    if (o.items && o.items.length && typeof o.items[0] === 'object') {
      itemsStr = JSON.stringify(o.items).replace(/"/g, '""');
    } else {
      itemsStr = (o.items || []).join(';');
    }
    return [
      o.id,
      o.date,
      o.period,
      o.pv,
      o.valor,
      o.frete || 0,
      `"${(o.recipient||'').replace(/"/g,'""')}"`,
      o.tipo,
      `"${itemsStr}"`,
      o.hasLRP ? 'true' : 'false',
      cId,
      cNm
    ].join(',');
  });
  return [header, ...rows].join('\r\n');
}

function toXML(orders, consultant) {
  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const consStr = consultant ? `  <consultant>\n    <id>${esc(consultant.id)}</id>\n    <name>${esc(consultant.name)}</name>\n  </consultant>\n` : '';
  const rows = orders.map(o => {
    let itemsStr = '';
    if (o.items && o.items.length && typeof o.items[0] === 'object') {
      itemsStr = esc(JSON.stringify(o.items));
    } else {
      itemsStr = esc((o.items || []).join(';'));
    }
    return `    <order>
      <id>${esc(o.id)}</id>
      <date>${esc(o.date)}</date>
      <period>${esc(o.period)}</period>
      <pv>${o.pv}</pv>
      <valor>${o.valor}</valor>
      <frete>${o.frete || 0}</frete>
      <recipient>${esc(o.recipient)}</recipient>
      <tipo>${esc(o.tipo)}</tipo>
      <items>${itemsStr}</items>
      <hasLRP>${o.hasLRP?'true':'false'}</hasLRP>
    </order>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<pvdoterra>\n${consStr}  <orders>\n${rows.join('\n')}\n  </orders>\n</pvdoterra>`;
}

// ─── UI HELPERS ─────────────────────────────────────────
function setStatus(type, icon, text) {
  const box = document.getElementById('status-box');
  box.className = 'status-box ' + type;
  box.style.display = 'flex';
  document.getElementById('status-text').textContent = text;
  box.querySelector('.status-icon').textContent = icon;
}

function setProgress(pct, label) {
  document.getElementById('prog-bar').style.width = pct + '%';
  document.getElementById('prog-label').textContent = label;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
