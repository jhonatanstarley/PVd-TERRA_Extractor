// ═══════════════════════════════════════════════════════
//  PVdōTERRA Extractor — Content Script
//  Roda em: https://office.doterra.com/...OrderHistoryFull
// ═══════════════════════════════════════════════════════

let isRunning = false;

// Se não estamos no doTERRA EVO, apenas sinaliza a presença da extensão para a Dashboard Fiori
if (!location.href.toLowerCase().includes('orderhistoryfull') && !document.getElementById('OrderhistoryRows')) {
  try {
    const indicator = document.createElement('div');
    indicator.id = 'pv-ext-indicator';
    indicator.style.display = 'none';
    (document.body || document.documentElement).appendChild(indicator);
  } catch(e) {}
}

// Escuta mensagens do popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'ping') {
    sendResponse({ ok: true, onHistoryPage: isOnHistoryPage() });
    return true;
  }
  if (msg.action === 'start_extraction') {
    if (isRunning) { sendResponse({ error: 'Extração já em andamento' }); return true; }
    startExtraction(msg.format || 'json').then(result => sendResponse(result)).catch(e => sendResponse({ error: e.message }));
    return true; // async
  }
  if (msg.action === 'get_quick_count') {
    const rows = document.querySelectorAll('#OrderhistoryRows tr');
    sendResponse({ count: rows.length });
    return true;
  }
});

function isOnHistoryPage() {
  return location.href.toLowerCase().includes('orderhistoryfull') ||
         !!document.getElementById('OrderhistoryRows');
}

// ─── MAIN EXTRACTION FLOW ───────────────────────────────
async function startExtraction(format) {
  isRunning = true;
  try {
    sendProgress('Iniciando carregamento de todos os pedidos…', 0);

    // Clica "Ver mais" até esgotar
    await clickAllViewMore();

    sendProgress('Extraindo dados da tabela…', 90);
    const orders = parseOrders();

    // Fetch detalhes completos das faturas
    await fetchOrderDetails(orders);

    const consultant = extractConsultantInfo(orders);

    sendProgress(`${orders.length} pedidos extraídos. Gerando arquivo…`, 98);
    return { ok: true, orders, consultant, count: orders.length };
  } finally {
    isRunning = false;
  }
}

function extractConsultantInfo(orders) {
  let name = '';
  let id = '';
  
  // Tenta encontrar o ID e Nome no popup da conta doTERRA
  const accPopup = document.querySelector('#myaccountpopup_new .ui.top.attached.segment');
  if (accPopup) {
    const text = getText(accPopup);
    // Exemplo: "DE SOUZA, LILIA - 18008887"
    const parts = text.split('-');
    if (parts.length >= 2) {
      name = parts[0].trim();
      id = parts[1].trim();
    } else {
      name = text;
    }
  }

  // Fallback: Tentativas clássicas se falhar
  if (!name) {
    const nameNode = document.querySelector('.user-name, #my-account-name, .member-name');
    if (nameNode) name = getText(nameNode);
  }
  if (!id) {
    const idNode = document.querySelector('.distributor-id, #memberid, [name="DistributorID"], .member-id');
    if (idNode) id = getText(idNode).replace(/\D/g, '');
  }
  
  // Fallback: Descobre o nome pelo destinatário mais comum dos pedidos
  if (!name && orders.length > 0) {
    const counts = {};
    let max = 0;
    orders.forEach(o => {
      if (!o.recipient) return;
      counts[o.recipient] = (counts[o.recipient] || 0) + 1;
      if (counts[o.recipient] > max) { max = counts[o.recipient]; name = o.recipient; }
    });
  }
  return { name: name || 'Consultor(a)', id: id || '' };
}

// ─── CLICK "VER MAIS" LOOP ──────────────────────────────
async function clickAllViewMore() {
  let lastCount = 0;
  let noChangeRounds = 0;
  const MAX_NO_CHANGE = 3; // 3 rounds sem novos dados = fim
  let round = 0;

  while (noChangeRounds < MAX_NO_CHANGE) {
    const tbody = document.getElementById('OrderhistoryRows');
    if (!tbody) break;

    const currentCount = tbody.querySelectorAll('tr').length;

    // Tenta achar o link "Ver mais"
    const verMaisLink = findVerMaisLink();
    if (!verMaisLink) {
      // Não há mais link — carregou tudo
      break;
    }

    round++;
    const pct = Math.min(85, round * 3);
    sendProgress(`Carregando pedidos… (lote ${round}, ${currentCount} linhas)`, pct);

    // Clica via elemento ou chamando VIEWMORE diretamente
    try {
      if (typeof window.VIEWMORE === 'function') {
        window.VIEWMORE(-3);
      } else {
        verMaisLink.click();
      }
    } catch(e) {
      verMaisLink.click();
    }

    // Aguarda carregamento (polling)
    await waitForNewRows(currentCount, 6000);

    const newCount = tbody.querySelectorAll('tr').length;
    if (newCount === lastCount) {
      noChangeRounds++;
    } else {
      noChangeRounds = 0;
      lastCount = newCount;
    }
  }
}

function findVerMaisLink() {
  // Busca por texto "Ver mais" ou pelo onclick VIEWMORE
  const links = document.querySelectorAll('a');
  for (const a of links) {
    const txt = a.textContent.trim().toLowerCase();
    const onclick = (a.getAttribute('onclick') || '').toLowerCase();
    if (txt.includes('ver mais') || onclick.includes('viewmore')) {
      // Verifica se está visível
      const style = window.getComputedStyle(a);
      if (style.display !== 'none' && style.visibility !== 'hidden') {
        return a;
      }
    }
  }
  return null;
}

async function waitForNewRows(previousCount, timeout = 6000) {
  const tbody = document.getElementById('OrderhistoryRows');
  if (!tbody) return;

  const start = Date.now();
  return new Promise(resolve => {
    const check = () => {
      const now = tbody.querySelectorAll('tr').length;
      if (now > previousCount) {
        // Tem novas linhas — espera mais 800ms pra estabilizar
        setTimeout(resolve, 800);
      } else if (Date.now() - start > timeout) {
        resolve();
      } else {
        setTimeout(check, 300);
      }
    };
    check();
  });
}

// ─── PARSE DA TABELA ────────────────────────────────────
function parseOrders() {
  const tbody = document.getElementById('OrderhistoryRows');
  if (!tbody) return [];

  const rows = tbody.querySelectorAll('tr');
  const orders = [];

  rows.forEach(tr => {
    const tds = tr.querySelectorAll('td');
    if (tds.length < 8) return; // linha inválida

    try {
      // Extrai número do pedido via link
      const orderLink = tr.querySelector('a[href*="ODHNumber"]');
      if (!orderLink) return;
      const idMatch = orderLink.href.match(/ODHNumber=(\d+)/i);
      if (!idMatch) return;
      const id = idMatch[1];

      // Tipo (td[2])
      const tipo = getText(tds[1] || tds[2]);

      // Destinatário (td[3])
      const recipient = getText(tds[3]);

      // Itens / produtos — pode estar em td[4] ou td[5]
      const itemsCells = tr.querySelectorAll('td.gen');
      let itemsText = '';
      // td com múltiplos códigos de produto (números > 5 dígitos)
      for (const td of tds) {
        const t = td.innerText || td.textContent || '';
        const codes = t.match(/\b\d{4,10}\b/g);
        if (codes && codes.length > 0 && !t.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          // Verifica se não é uma data ou número de pedido
          const validCodes = codes.filter(c => c.length >= 4 && c !== id);
          if (validCodes.length > 0 && !itemsText) {
            itemsText = validCodes.join(';');
          }
        }
      }

      // Data — td com formato dd/mm/yyyy
      let date = '';
      for (const td of tds) {
        const t = getText(td);
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) { date = t; break; }
      }

      // Período PV — td com formato m/yyyy ou mm/yyyy
      let period = '';
      for (const td of tds) {
        const t = getText(td);
        if (/^\d{1,2}\/\d{4}$/.test(t)) { period = t; break; }
      }

      // Volume PV — td com data-sort-value e valor decimal (não é R$)
      let pv = 0;
      let valor = 0;
      const pvTds = tr.querySelectorAll('td[data-sort-value]');
      if (pvTds.length >= 1) pv = parseFloat(pvTds[0].getAttribute('data-sort-value')) || 0;
      if (pvTds.length >= 2) valor = parseFloat(pvTds[pvTds.length - 1].getAttribute('data-sort-value')) || 0;

      // Items como array
      const items = itemsText ? itemsText.split(';').map(s => s.trim()).filter(Boolean) : [];
      const hasLRP = items.some(c => /^2\d{3}$/.test(c));

      orders.push({ id, date, period, pv, valor, recipient, tipo, items, hasLRP });
    } catch (e) {
      // linha ignorada
    }
  });

  return orders;
}

function getText(el) {
  if (!el) return '';
  return (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
}

// ─── PROGRESS ───────────────────────────────────────────
function sendProgress(message, percent) {
  try {
    chrome.runtime.sendMessage({ action: 'progress', message, percent });
  } catch(e) {}
}

// ─── INJEÇÃO DO BOTÃO UI NA PÁGINA ─────────────────────────
function injectExtractionButton() {
  if (document.getElementById('pvdt-extract-btn')) return;
  
  const btn = document.createElement('button');
  btn.id = 'pvdt-extract-btn';
  btn.textContent = 'Extrair Dados (PVdōTERRA)';
  btn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #ef4444;
    color: white;
    font-weight: bold;
    padding: 12px 24px;
    border-radius: 8px;
    border: none;
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);
    cursor: pointer;
    z-index: 9999999;
    font-size: 16px;
    transition: all 0.2s;
  `;
  
  btn.onmouseover = () => btn.style.background = '#dc2626';
  btn.onmouseout = () => btn.style.background = '#ef4444';
  
  btn.onclick = async () => {
    btn.textContent = '⏳ Extraindo... Mantenha a aba aberta!';
    btn.disabled = true;
    btn.style.background = '#6b7280';
    try {
      const result = await startExtraction('json');
      if (result.ok) {
        // Gerar e baixar arquivo json nativamente
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0,19);
        a.download = `pvdoterra-historico-${ts}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        btn.textContent = '✅ Arquivo Baixado!';
        btn.style.background = '#10b981';
      }
    } catch (err) {
      btn.textContent = '❌ Falha. Tente novamente.';
      btn.style.background = '#ef4444';
      console.error(err);
    }
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'Extrair Dados (PVdōTERRA)';
      btn.style.background = '#ef4444';
    }, 4000);
  };
  
  document.body.appendChild(btn);
}

// Verifica a cada 2s se estamos na página correta para injetar o botão
setInterval(() => {
  if (isOnHistoryPage()) injectExtractionButton();
}, 2000);

// ─── FETCH DETALHES DA FATURA (BACKGROUND) ───────────────
async function fetchOrderDetails(orders) {
  const BATCH_SIZE = 5; // Busca 5 pedidos por vez num pool concorrente
  for (let i = 0; i < orders.length; i += BATCH_SIZE) {
    const batch = orders.slice(i, i + BATCH_SIZE);
    
    const pct = 90 + Math.floor(((i + batch.length) / orders.length) * 8); // Vai de 90 a 98%
    sendProgress(`Buscando cupons fiscais (${i + batch.length} de ${orders.length} pedidos)...`, pct);

    await Promise.all(batch.map(async (o) => {
      try {
        const url = `https://office.doterra.com/index.cfm?fuseaction=evo_Modules.OrderInvoice&ODHNumber=${o.id}`;
        const resp = await fetch(url);
        if (!resp.ok) return;

        const html = await resp.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const tabela = doc.querySelector('table.ui.striped.unstackable.table.bigEVOTable');
        if (!tabela) return;

        const linhas = tabela.querySelectorAll('tbody tr');
        const dadosExtraidos = [];

        linhas.forEach(linha => {
          const celulas = linha.querySelectorAll('td');
          if (celulas.length === 8) {
            // Conversão de valores pt-BR "12,34" -> 12.34
            const pvStr = celulas[4].innerText.trim().replace(',', '.');
            const pvTotalStr = celulas[5].innerText.trim().replace(',', '.');
            const priceStr = celulas[6].innerText.trim().replace(/[^\d.,]/g, '').replace(',', '.');
            const priceTotalStr = celulas[7].innerText.trim().replace(/[^\d.,]/g, '').replace(',', '.');

            const item = {
              code: celulas[0].innerText.trim(),
              name: celulas[3].innerText.trim().replace(/\n/g, ' - ').replace(/\s{2,}/g, ' '),
              qty: parseInt(celulas[1].innerText.trim(), 10) || 1,
              pv: parseFloat(pvStr) || 0,
              pvTotal: parseFloat(pvTotalStr) || 0,
              price: parseFloat(priceStr) || 0,
              priceTotal: parseFloat(priceTotalStr) || 0
            };
            dadosExtraidos.push(item);
          }
        });

        // Só sobrescreve os items parseados simples da tabela principal se obteve sucesso na fatura.
        if (dadosExtraidos.length > 0) {
          o.items = dadosExtraidos;
        }

      } catch (err) {
        console.warn(`Erro ao buscar fatura do pedido ${o.id}:`, err);
      }
    }));
    
    // Pequeno delay entre batches para evitar Rate Limit e WAF Blocks (ex: Imperva)
    await new Promise(r => setTimeout(r, 600));
  }
}
