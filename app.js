'use strict';

const STORAGE_KEY = 'nova_weekly_budget_v2';

let state = {
  income: 0,
  debts: []
};

const el = id => document.getElementById(id);

function formatMXN(amount) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      state.income = Number(saved.income) || 0;
      state.debts = Array.isArray(saved.debts) ? saved.debts : [];
    }
  } catch {
    state = { income: 0, debts: [] };
  }
  el('weeklyIncome').value = state.income > 0 ? state.income : '';
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function toggleDrawer(drawerId) {
  const target = el(drawerId);
  const isHidden = target.hidden;
  el('incomeDrawer').hidden = true;
  el('debtDrawer').hidden = true;
  target.hidden = !isHidden;
}

function render() {
  const list = el('debtList');
  list.innerHTML = '';

  let totalDebt = 0;
  let weeklyDebtRequired = 0;

  state.debts.forEach((debt, index) => {
    const weeklyShare = debt.total / debt.weeks;
    totalDebt += debt.total;
    weeklyDebtRequired += weeklyShare;

    const initial = debt.name.charAt(0).toUpperCase();
    const colorClass = `c-${index % 4}`;

    const li = document.createElement('li');
    li.className = 'debt-item';
    li.innerHTML = `
      <div class="debt-left">
        <div class="debt-icon ${colorClass}">${initial}</div>
        <div class="debt-meta">
          <strong>${debt.name}</strong>
          <small>Restante: ${formatMXN(debt.total)} • ${debt.weeks} ${debt.weeks === 1 ? 'sem' : 'sems'}</small>
        </div>
      </div>
      <div class="debt-right">
        <span class="debt-amount">-${formatMXN(weeklyShare)}</span>
        <button class="btn-del" data-index="${index}" aria-label="Eliminar">×</button>
      </div>
    `;
    list.appendChild(li);
  });

  const freeMoney = state.income - weeklyDebtRequired;
  const pct = state.income > 0 ? Math.min(100, Math.round((weeklyDebtRequired / state.income) * 100)) : 0;

  el('resFree').textContent = formatMXN(freeMoney);
  el('resWeeklyDebt').textContent = formatMXN(weeklyDebtRequired);
  el('resTotalDebt').textContent = `Deuda total: ${formatMXN(totalDebt)}`;
  el('resIncome').textContent = formatMXN(state.income);
  el('debtProgress').style.width = `${pct}%`;
  el('debtPct').textContent = `${pct}%`;
  el('debtCount').textContent = `${state.debts.length} ${state.debts.length === 1 ? 'activa' : 'activas'}`;

  const hero = el('heroCard');
  const pill = el('statusPill');
  const advice = el('resAdvice');

  if (state.income === 0 && weeklyDebtRequired === 0) {
    hero.classList.remove('deficit');
    pill.textContent = '•';
    advice.textContent = 'Toca "Ingresar Ganancia" para iniciar';
  } else if (freeMoney < 0) {
    hero.classList.add('deficit');
    pill.textContent = '!';
    advice.textContent = `Te faltan ${formatMXN(Math.abs(freeMoney))} para cubrir deudas`;
  } else {
    hero.classList.remove('deficit');
    pill.textContent = '✓';
    advice.textContent = `Apartas ${pct}% a deudas • ${100 - pct}% libre para ti`;
  }
}

/* EVENTOS */
el('btnOpenIncome').addEventListener('click', () => {
  toggleDrawer('incomeDrawer');
  el('weeklyIncome').focus();
});

el('btnOpenDebt').addEventListener('click', () => {
  toggleDrawer('debtDrawer');
  el('debtName').focus();
});

el('navIncome').addEventListener('click', () => toggleDrawer('incomeDrawer'));
el('navDebt').addEventListener('click', () => toggleDrawer('debtDrawer'));
el('navHome').addEventListener('click', () => {
  el('incomeDrawer').hidden = true;
  el('debtDrawer').hidden = true;
});

document.querySelectorAll('.close-drawer').forEach(btn => {
  btn.addEventListener('click', () => {
    el(btn.dataset.close).hidden = true;
  });
});

el('saveIncomeBtn').addEventListener('click', () => {
  state.income = Math.max(0, parseFloat(el('weeklyIncome').value) || 0);
  saveState();
  render();
  el('incomeDrawer').hidden = true;
});

el('debtForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = el('debtName').value.trim();
  const total = parseFloat(el('debtTotal').value);
  const weeks = parseInt(el('debtWeeks').value, 10) || 1;

  if (!name || isNaN(total) || total <= 0) return;

  state.debts.push({ name, total, weeks });
  saveState();
  render();

  el('debtName').value = '';
  el('debtTotal').value = '';
  el('debtWeeks').value = '1';
  el('debtDrawer').hidden = true;
});

el('debtList').addEventListener('click', e => {
  if (e.target.classList.contains('btn-del')) {
    const idx = parseInt(e.target.dataset.index, 10);
    state.debts.splice(idx, 1);
    saveState();
    render();
  }
});

/* ABONAR SEMANA (DESCUENTA EL PAGO SEMANAL DE CADA DEUDA) */
el('btnPayWeek').addEventListener('click', () => {
  if (state.debts.length === 0) return;
  state.debts = state.debts
    .map(d => {
      const payment = d.total / d.weeks;
      return {
        name: d.name,
        total: Math.max(0, d.total - payment),
        weeks: Math.max(0, d.weeks - 1)
      };
    })
    .filter(d => d.weeks > 0 && d.total > 0.5);

  saveState();
  render();
});

el('btnResetWeek').addEventListener('click', () => {
  state.income = 0;
  el('weeklyIncome').value = '';
  saveState();
  render();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

loadState();
render();
