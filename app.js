'use strict';

const STORAGE_KEY = 'nova_weekly_tracker_v5';

let state = {
  income: 0,
  debts: [],     // { id, name, amount, dueDay } -> Guía de ahorro
  expenses: [],  // { id, title, amount, category, date } -> Gastos de la semana actual
  history: []    // { id, closedAt, income, totalSpent, balance, expenses } -> Semanas pasadas
};

const el = id => document.getElementById(id);

const CATEGORY_ICONS = {
  Comida: '🍴',
  Transporte: '🚗',
  Personal: '🛒',
  Servicios: '💼',
  Otro: '📌'
};

function formatMXN(amount) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
}

function getNextPaymentInfo(dueDay) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const clampDay = (year, month, day) => {
    const maxDays = new Date(year, month + 1, 0).getDate();
    return Math.min(day, maxDays);
  };

  let targetYear = today.getFullYear();
  let targetMonth = today.getMonth();
  let targetDate = new Date(targetYear, targetMonth, clampDay(targetYear, targetMonth, dueDay));

  if (targetDate < today) {
    targetMonth += 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
    targetDate = new Date(targetYear, targetMonth, clampDay(targetYear, targetMonth, dueDay));
  }

  const diffMs = targetDate - today;
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7));
  const dateText = targetDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

  return { daysLeft, weeksLeft, dateText };
}

function formatDateLabel(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      state.income = Number(saved.income) || 0;
      state.debts = Array.isArray(saved.debts) ? saved.debts : [];
      state.expenses = Array.isArray(saved.expenses) ? saved.expenses : [];
      state.history = Array.isArray(saved.history) ? saved.history : [];
    }
  } catch {
    state = { income: 0, debts: [], expenses: [], history: [] };
  }
  el('weeklyIncome').value = state.income > 0 ? state.income : '';
  el('expDate').value = new Date().toISOString().split('T')[0];
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function toggleDrawer(drawerId) {
  const target = el(drawerId);
  const isHidden = target.hidden;
  el('incomeDrawer').hidden = true;
  el('expenseDrawer').hidden = true;
  el('debtDrawer').hidden = true;
  target.hidden = !isHidden;
}

function render() {
  /* 1. DEUDAS (META DE AHORRO SEMANAL) */
  const debtList = el('debtList');
  debtList.innerHTML = '';

  let weeklyDebtSave = 0;

  const sortedDebts = [...state.debts].sort((a, b) => {
    return getNextPaymentInfo(a.dueDay).daysLeft - getNextPaymentInfo(b.dueDay).daysLeft;
  });

  sortedDebts.forEach((debt, index) => {
    const info = getNextPaymentInfo(debt.dueDay);
    const weeklyShare = debt.amount / info.weeksLeft;
    weeklyDebtSave += weeklyShare;

    const li = document.createElement('li');
    li.className = 'debt-item';
    li.innerHTML = `
      <div class="debt-left">
        <div class="debt-icon c-${index % 4}">${debt.dueDay}</div>
        <div class="debt-meta">
          <strong>${debt.name}</strong>
          <small>Pago: ${formatMXN(debt.amount)} • Vence ${info.dateText} (${info.daysLeft === 0 ? 'Hoy' : `en ${info.daysLeft}d`})</small>
        </div>
      </div>
      <div class="debt-right">
        <div>
          <span class="debt-weekly-tag">Ahorrar/sem:</span>
          <span class="debt-amount" style="color: #3ddc84;">${formatMXN(weeklyShare)}</span>
        </div>
        <button class="btn-del" data-type="debt" data-id="${debt.id}" aria-label="Eliminar">×</button>
      </div>
    `;
    debtList.appendChild(li);
  });

  /* 2. GASTOS DE ESTA SEMANA */
  const expList = el('expenseList');
  expList.innerHTML = '';

  let totalSpent = 0;

  state.expenses.forEach(exp => {
    totalSpent += exp.amount;
    const icon = CATEGORY_ICONS[exp.category] || '📌';

    const li = document.createElement('li');
    li.className = 'debt-item';
    li.innerHTML = `
      <div class="debt-left">
        <div class="debt-icon c-${exp.category}">${icon}</div>
        <div class="debt-meta">
          <strong>${exp.title}</strong>
          <small>${formatDateLabel(exp.date)} • ${exp.category}</small>
        </div>
      </div>
      <div class="debt-right">
        <span class="debt-amount">-${formatMXN(exp.amount)}</span>
        <button class="btn-del" data-type="expense" data-id="${exp.id}" aria-label="Eliminar">×</button>
      </div>
    `;
    expList.appendChild(li);
  });

  /* 3. HISTORIAL DE SEMANAS PASADAS */
  const historyList = el('historyList');
  historyList.innerHTML = '';

  state.history.forEach(week => {
    const detailsHtml = week.expenses.length > 0
      ? week.expenses.map(e => `<div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#8e8ca0; margin-top:4px;"><span>• ${e.title} (${e.category})</span><span>-${formatMXN(e.amount)}</span></div>`).join('')
      : '<div style="font-size:0.75rem; color:#8e8ca0; margin-top:4px;">Sin gastos registrados</div>';

    const li = document.createElement('li');
    li.className = 'debt-item';
    li.style.flexDirection = 'column';
    li.style.alignItems = 'stretch';
    li.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div class="debt-left">
          <div class="debt-icon c-Otro">📅</div>
          <div class="debt-meta">
            <strong>Semana cerrada: ${week.closedAt}</strong>
            <small>Ganado: ${formatMXN(week.income)} • Gastado: ${formatMXN(week.totalSpent)}</small>
          </div>
        </div>
        <div class="debt-right">
          <div>
            <span class="debt-weekly-tag">Sobró:</span>
            <span class="debt-amount" style="color: ${week.balance >= 0 ? '#3ddc84' : '#ff6b6b'};">${formatMXN(week.balance)}</span>
          </div>
          <button class="btn-del" data-type="history" data-id="${week.id}" aria-label="Eliminar">×</button>
        </div>
      </div>
      <div style="border-top: 1px solid rgba(255,255,255,0.06); margin-top: 10px; padding-top: 6px;">
        ${detailsHtml}
      </div>
    `;
    historyList.appendChild(li);
  });

  /* 4. TOTALES Y SALDO LIBRE */
  const availableBalance = state.income - totalSpent;
  const spentPct = state.income > 0 ? Math.min(100, Math.round((totalSpent / state.income) * 100)) : 0;

  el('resFree').textContent = formatMXN(availableBalance);
  el('resWeeklyDebt').textContent = formatMXN(weeklyDebtSave);
  el('resSpent').textContent = `Gastado: ${formatMXN(totalSpent)}`;
  el('resIncome').textContent = formatMXN(state.income);
  el('usedProgress').style.width = `${spentPct}%`;
  el('usedPct').textContent = `${spentPct}%`;

  el('debtCount').textContent = `${state.debts.length} ${state.debts.length === 1 ? 'deuda' : 'deudas'}`;
  el('expCount').textContent = `${state.expenses.length} ${state.expenses.length === 1 ? 'gasto' : 'gastos'}`;
  el('historyCount').textContent = `${state.history.length} ${state.history.length === 1 ? 'guardada' : 'guardadas'}`;

  const hero = el('heroCard');
  const pill = el('statusPill');
  const advice = el('resAdvice');

  if (state.income === 0 && totalSpent === 0) {
    hero.classList.remove('deficit');
    pill.textContent = '•';
    advice.textContent = weeklyDebtSave > 0
      ? `Meta semanal de ahorro para deudas: ${formatMXN(weeklyDebtSave)}`
      : 'Ingresa tu salario semanal para iniciar';
  } else if (availableBalance < 0) {
    hero.classList.add('deficit');
    pill.textContent = '!';
    advice.textContent = `Excediste tu salario por ${formatMXN(Math.abs(availableBalance))}`;
  } else if (weeklyDebtSave > 0) {
    hero.classList.remove('deficit');
    pill.textContent = '✓';
    const afterSaving = availableBalance - weeklyDebtSave;
    advice.textContent = afterSaving >= 0
      ? `Si apartas ${formatMXN(weeklyDebtSave)} de deudas, te quedan ${formatMXN(afterSaving)}`
      : `Te faltan ${formatMXN(Math.abs(afterSaving))} para cubrir la meta de ahorro`;
  } else {
    hero.classList.remove('deficit');
    pill.textContent = '✓';
    advice.textContent = `Has gastado el ${spentPct}% de tu salario semanal`;
  }
}

/* EVENTOS BOTONES */
el('btnOpenExpense').addEventListener('click', () => {
  toggleDrawer('expenseDrawer');
  el('expTitle').focus();
});

el('btnOpenDebt').addEventListener('click', () => {
  toggleDrawer('debtDrawer');
  el('debtName').focus();
});

el('btnOpenIncome').addEventListener('click', () => {
  toggleDrawer('incomeDrawer');
  el('weeklyIncome').focus();
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

el('expenseForm').addEventListener('submit', e => {
  e.preventDefault();
  const title = el('expTitle').value.trim();
  const amount = parseFloat(el('expAmount').value);
  const category = el('expCategory').value;
  const date = el('expDate').value;

  if (!title || isNaN(amount) || amount <= 0) return;

  state.expenses.unshift({
    id: Date.now(),
    title,
    amount,
    category,
    date
  });

  saveState();
  render();

  el('expTitle').value = '';
  el('expAmount').value = '';
  el('expenseDrawer').hidden = true;
});

el('debtForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = el('debtName').value.trim();
  const amount = parseFloat(el('debtAmount').value);
  const dueDay = parseInt(el('debtDay').value, 10);

  if (!name || isNaN(amount) || amount <= 0 || isNaN(dueDay) || dueDay < 1 || dueDay > 31) return;

  state.debts.push({
    id: Date.now(),
    name,
    amount,
    dueDay
  });

  saveState();
  render();

  el('debtName').value = '';
  el('debtAmount').value = '';
  el('debtDay').value = '';
  el('debtDrawer').hidden = true;
});

document.addEventListener('click', e => {
  if (!e.target.classList.contains('btn-del')) return;
  const id = Number(e.target.dataset.id);
  const type = e.target.dataset.type;

  if (type === 'debt') {
    state.debts = state.debts.filter(d => d.id !== id);
  } else if (type === 'expense') {
    state.expenses = state.expenses.filter(exp => exp.id !== id);
  } else if (type === 'history') {
    state.history = state.history.filter(h => h.id !== id);
  }

  saveState();
  render();
});

/* CERRAR SEMANA (ARCHIVA LA SEMANA ACTUAL EN HISTORIAL Y LIMPIA PARA LA NUEVA) */
el('btnArchiveWeek').addEventListener('click', () => {
  if (state.income === 0 && state.expenses.length === 0) return;

  const totalSpent = state.expenses.reduce((acc, item) => acc + item.amount, 0);
  const closedAt = new Date().toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  state.history.unshift({
    id: Date.now(),
    closedAt,
    income: state.income,
    totalSpent,
    balance: state.income - totalSpent,
    expenses: [...state.expenses]
  });

  state.income = 0;
  state.expenses = [];
  el('weeklyIncome').value = '';
  saveState();
  render();
});

/* NAVEGACIÓN INFERIOR */
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const tab = btn.dataset.tab;
    el('sectionExpenses').hidden = tab !== 'all' && tab !== 'expenses';
    el('sectionDebts').hidden = tab !== 'all' && tab !== 'debts';
    el('sectionHistory').hidden = tab !== 'history';
  });
});

el('todayLabel').textContent = new Date().toLocaleDateString('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'short'
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

loadState();
render();
