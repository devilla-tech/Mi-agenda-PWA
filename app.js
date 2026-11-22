'use strict';

const STORAGE_KEY = 'nova_weekly_tracker_v3';

let state = {
  income: 0,
  debts: [],     // { id, name, amount, dueDay }
  expenses: []   // { id, title, amount, category, date }
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

/* Calcula días y semanas restantes hasta la próxima fecha de pago (día 1..31) */
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

  // Si la fecha de pago ya pasó este mes, calcular para el próximo mes
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
    }
  } catch {
    state = { income: 0, debts: [], expenses: [] };
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
  /* 1. RENDERIZAR DEUDAS Y CALCULAR AHORRO SEMANAL REQUERIDO */
  const debtList = el('debtList');
  debtList.innerHTML = '';

  let weeklyDebtSave = 0;

  // Ordenar deudas por proximidad de fecha de pago
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
          <span class="debt-weekly-tag">Ahorrar hoy:</span>
          <span class="debt-amount">${formatMXN(weeklyShare)}</span>
        </div>
        <button class="btn-del" data-type="debt" data-id="${debt.id}" aria-label="Eliminar">×</button>
      </div>
    `;
    debtList.appendChild(li);
  });

  /* 2. RENDERIZAR GASTOS REGISTRADOS */
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

  /* 3. CALCULAR TOTALES Y SALDO LIBRE */
  const totalCommitted = weeklyDebtSave + totalSpent;
  const freeMoney = state.income - totalCommitted;
  const pct = state.income > 0 ? Math.min(100, Math.round((totalCommitted / state.income) * 100)) : 0;

  el('resFree').textContent = formatMXN(freeMoney);
  el('resWeeklyDebt').textContent = formatMXN(weeklyDebtSave);
  el('resSpent').textContent = `Gastado: ${formatMXN(totalSpent)}`;
  el('resIncome').textContent = formatMXN(state.income);
  el('usedProgress').style.width = `${pct}%`;
  el('usedPct').textContent = `${pct}%`;

  el('debtCount').textContent = `${state.debts.length} ${state.debts.length === 1 ? 'deuda' : 'deudas'}`;
  el('expCount').textContent = `${state.expenses.length} ${state.expenses.length === 1 ? 'gasto' : 'gastos'}`;

  const hero = el('heroCard');
  const pill = el('statusPill');
  const advice = el('resAdvice');

  if (state.income === 0 && totalCommitted === 0) {
    hero.classList.remove('deficit');
    pill.textContent = '•';
    advice.textContent = 'Ingresa tu salario semanal para calcular';
  } else if (freeMoney < 0) {
    hero.classList.add('deficit');
    pill.textContent = '!';
    advice.textContent = `Te faltan ${formatMXN(Math.abs(freeMoney))} para cubrir deudas y gastos`;
  } else {
    hero.classList.remove('deficit');
    pill.textContent = '✓';
    advice.textContent = `Ya descontando ahorro de deudas y gastos`;
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

/* ELIMINAR GASTO O DEUDA */
document.addEventListener('click', e => {
  if (!e.target.classList.contains('btn-del')) return;
  const id = Number(e.target.dataset.id);
  const type = e.target.dataset.type;

  if (type === 'debt') {
    state.debts = state.debts.filter(d => d.id !== id);
  } else if (type === 'expense') {
    state.expenses = state.expenses.filter(exp => exp.id !== id);
  }

  saveState();
  render();
});

/* NUEVA SEMANA (LIMPIA SALARIO Y GASTOS DE LA SEMANA, MANTIENE TUS DEUDAS FIJAS) */
el('btnResetWeek').addEventListener('click', () => {
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
    el('sectionExpenses').hidden = tab === 'debts';
    el('sectionDebts').hidden = tab === 'expenses';
  });
});

/* FECHA EN HEADER */
el('todayLabel').textContent = new Date().toLocaleDateString('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'short'
});

/* REGISTRO SERVICE WORKER */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

loadState();
render();
