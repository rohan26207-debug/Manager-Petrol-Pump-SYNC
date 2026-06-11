/**
 * Local Storage Service for Offline M.Pump Calc
 * Handles all data persistence in browser localStorage
 * 100% offline - no cloud sync
 * Adds per-user namespacing so different users never see each other's data
 */

// Active namespace prefix: e.g., "mpp:local:"
let ACTIVE_NAMESPACE = null;

// Helper to build namespaced key
const nsKey = (baseKey) => (ACTIVE_NAMESPACE ? `${ACTIVE_NAMESPACE}${baseKey}` : baseKey);

// Legacy alternate keys written by older listeners (without mpump_ prefix)
const LEGACY_ALT_KEYS = {
  mpump_customers: ['customers'],
  mpump_credit_data: ['creditData'],
  mpump_payments: ['payments'],
  mpump_settlements: ['settlements'],
  mpump_sales_data: ['salesData'],
  mpump_income_data: ['incomeData'],
  mpump_expense_data: ['expenseData'],
  mpump_fuel_settings: [],
  mpump_rates_by_date: [],
  mpump_income_categories: [],
  mpump_expense_categories: [],
  mpump_settlement_types: [],
  mpump_income_desc_history: [],
  mpump_expense_desc_history: [],
};

// Other singleton keys that may exist without mpump_ prefix
const LEGACY_MISC_KEYS = [
  'mpump_contact_info',
  'mpp_notes',
  'mpump_online_url',
  'mpump_auto_backup_settings',
  'mpump_auto_backup_weekly_settings',
  'appTextSize',
  'appTheme'
];

// Detect and require lazily to avoid circular deps
// Firebase sync removed - fully offline mode

class LocalStorageService {
  constructor() {
    this.keys = {
      salesData: 'mpump_sales_data',
      creditData: 'mpump_credit_data',
      incomeData: 'mpump_income_data',
      expenseData: 'mpump_expense_data',
      fuelSettings: 'mpump_fuel_settings',
      rates: 'mpump_rates_by_date',
      customers: 'mpump_customers',
      payments: 'mpump_payments',
      incomeCategories: 'mpump_income_categories',
      expenseCategories: 'mpump_expense_categories',
      settlements: 'mpump_settlements',
      settlementTypes: 'mpump_settlement_types',
      incomeDescHistory: 'mpump_income_desc_history',
      expenseDescHistory: 'mpump_expense_desc_history',
      cashOwnerEntries: 'mpump_cash_owner_entries'
    };
    this.onSyncCallback = null;

    // Do not initialize defaults until a namespace is set (guest or user)
  }

  // ===== Namespace management =====
  setNamespace(userId) {
    const prevNs = ACTIVE_NAMESPACE;
    ACTIVE_NAMESPACE = userId ? `mpp:${userId}:` : 'mpp:guest:';

    // On first set for a logged-in user, run migration from legacy unscoped/alt keys
    if (userId) {
      this.migrateLegacyKeys({ deleteAfter: true });
    }

    // Ensure defaults exist within this namespace
    this.initializeDefaultData();

    // Announce namespace switch to UI (for any listeners interested)
    try {
      window.dispatchEvent(new CustomEvent('localStorageChange', { detail: { userId, namespace: ACTIVE_NAMESPACE } }));
    } catch (e) { console.warn('localStorage event dispatch failed:', e.message); }

    return { prevNs, newNs: ACTIVE_NAMESPACE };
  }

  getNamespace() {
    return ACTIVE_NAMESPACE;
  }

  clearNamespace() {
    const prevNs = ACTIVE_NAMESPACE;
    ACTIVE_NAMESPACE = 'mpp:guest:';
    this.initializeDefaultData();
    try {
      window.dispatchEvent(new CustomEvent('localStorageChange', { detail: { userId: null, namespace: ACTIVE_NAMESPACE } }));
    } catch (e) { console.warn('localStorage event dispatch failed:', e.message); }
    return prevNs;
  }

  // Move legacy unscoped data into the active namespace, then delete legacy keys
  migrateLegacyKeys({ deleteAfter = true } = {}) {
    if (!ACTIVE_NAMESPACE) return;

    const migrateKey = (baseKey, altKeys = []) => {
      const namespaced = nsKey(baseKey);
      const nsExists = localStorage.getItem(namespaced) !== null;
      if (nsExists) return; // Already migrated for this user

      // 1) Primary legacy (unscoped) key
      const legacyVal = localStorage.getItem(baseKey);
      if (legacyVal !== null) {
        localStorage.setItem(namespaced, legacyVal);
        if (deleteAfter) localStorage.removeItem(baseKey);
        return;
      }

      // 2) Alternate legacy keys used by older builds
      for (const alt of altKeys) {
        const val = localStorage.getItem(alt);
        if (val !== null) {
          localStorage.setItem(namespaced, val);
          if (deleteAfter) localStorage.removeItem(alt);
          return;
        }
      }
    };

    // Migrate structured data keys
    Object.entries(LEGACY_ALT_KEYS).forEach(([baseKey, alts]) => migrateKey(baseKey, alts));

    // Migrate misc single-value keys
    LEGACY_MISC_KEYS.forEach((k) => migrateKey(k, []));
    
    // CRITICAL: Always clean up any stray unnamespaced keys that might have been created
    this.cleanupUnnamedspacedKeys();
  }
  
  // Clean up any unnamespaced data keys (force cleanup on every load)
  cleanupUnnamedspacedKeys() {
    if (!ACTIVE_NAMESPACE) return;
    
    console.log('🧹 Cleaning up unnamespaced keys...');
    let cleanedCount = 0;
    
    // Remove all unnamespaced data keys
    Object.keys(LEGACY_ALT_KEYS).forEach(baseKey => {
      if (localStorage.getItem(baseKey) !== null) {
        console.log(`🗑️ Removing unnamespaced key: ${baseKey}`);
        localStorage.removeItem(baseKey);
        cleanedCount++;
      }
    });
    
    // Remove alternate legacy keys
    Object.values(LEGACY_ALT_KEYS).flat().forEach(altKey => {
      if (localStorage.getItem(altKey) !== null) {
        console.log(`🗑️ Removing alternate key: ${altKey}`);
        localStorage.removeItem(altKey);
        cleanedCount++;
      }
    });
    
    // Remove unnamespaced stock data keys (dieselStockData, petrolStockData, etc.)
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
      // Check if it's a stock data key without namespace
      if (key.toLowerCase().includes('stockdata') && !key.includes(':')) {
        console.log(`🗑️ Removing unnamespaced stock key: ${key}`);
        localStorage.removeItem(key);
        cleanedCount++;
      }
    });
    
    console.log(`✅ Cleanup complete - removed ${cleanedCount} unnamespaced keys`);
  }

  // ===== Initialization within the current namespace =====
  initializeDefaultData() {
    // Default fuel settings
    const defaultFuelSettings = {
      'Diesel': { price: 90.46, nozzleCount: 2 },
      'Petrol': { price: 102.50, nozzleCount: 3 },
      'CNG': { price: 75.20, nozzleCount: 2 },
      'Premium': { price: 108.90, nozzleCount: 1 }
    };

    const existingSettings = this.getFuelSettings();
    if (!existingSettings) {
      this.setFuelSettings(defaultFuelSettings);
    }

    // Initialize empty arrays if not exist
    if (!this.getSalesData()) this.setSalesData([]);
    if (!this.getCreditData()) this.setCreditData([]);
    if (!this.getIncomeData()) this.setIncomeData([]);
    if (!this.getExpenseData()) this.setExpenseData([]);
    if (!this.getCustomers()) this.setCustomers([]);
    if (!this.getPayments()) this.setPayments([]);
    if (!this.getSettlements()) this.setSettlements([]);

    // One-time migration (v2.3): Fuel Sales now includes testing in litres &
    // amount. Old records stored `liters = end-start-testing` (net). If an
    // existing record's `liters` matches the net formula, convert it to gross.
    this._migrateTestingIncludedInLiters();

    // Initialize default income/expense categories
    if (!this.getIncomeCategories()) {
      this.setIncomeCategories([
        { id: '1', name: 'Other Income' },
        { id: '2', name: 'Commission' },
        { id: '3', name: 'Interest' }
      ]);
    }
    if (!this.getExpenseCategories()) {
      this.setExpenseCategories([
        { id: '1', name: 'Salary' },
        { id: '2', name: 'Rent' },
        { id: '3', name: 'Electricity' },
        { id: '4', name: 'Maintenance' },
        { id: '5', name: 'Other' }
      ]);
    }

    // Initialize default settlement types
    const existingTypes = this.getItem(this.keys.settlementTypes);
    if (!existingTypes || existingTypes.length === 0) {
      this.setSettlementTypes([
        { id: 'builtin-cash', name: 'CASH', builtin: true },
        { id: 'builtin-neft', name: 'NEFT', builtin: true },
        { id: 'builtin-rtgs', name: 'RTGS', builtin: true },
        { id: 'builtin-cheque', name: 'Cheque', builtin: true },
        { id: '1', name: 'Card' },
        { id: '2', name: 'DTP' },
        { id: '3', name: 'Paytm' },
        { id: '4', name: 'PhonePe' }
      ]);
    } else {
      // Migration: ensure built-in types exist exactly once and use the
      // canonical display label. CASH is shown all-caps, others as below.
      const builtins = [
        { name: 'CASH', match: ['cash'] },
        { name: 'NEFT', match: ['neft'] },
        { name: 'RTGS', match: ['rtgs'] },
        { name: 'Cheque', match: ['cheque'] },
      ];
      const lc = (s) => (s || '').trim().toLowerCase();
      let changed = false;
      const seenBuiltins = new Set();
      const cleaned = existingTypes.filter((t) => {
        const tlc = lc(t.name);
        const matched = builtins.find((b) => b.match.includes(tlc));
        if (matched) {
          if (seenBuiltins.has(tlc)) { changed = true; return false; } // drop dup
          seenBuiltins.add(tlc);
          // Normalize to canonical label + builtin flag + stable id
          if (t.name !== matched.name || !t.builtin || t.id !== `builtin-${tlc}`) {
            t.name = matched.name;
            t.builtin = true;
            t.id = `builtin-${tlc}`;
            changed = true;
          }
        }
        return true;
      });
      // Add any missing built-ins
      builtins.forEach((b) => {
        if (!seenBuiltins.has(lc(b.name))) {
          cleaned.unshift({ id: `builtin-${lc(b.name)}`, name: b.name, builtin: true });
          changed = true;
        }
      });
      if (changed) this.setSettlementTypes(cleaned);
    }
  }

  // ===== Generic localStorage methods (namespaced) =====
  setItem(key, data) {
    try {
      localStorage.setItem(nsKey(key), JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      return false;
    }
  }

  getItem(key) {
    try {
      const data = localStorage.getItem(nsKey(key));
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to read from localStorage:', error);
      return null;
    }
  }

  // ===== Sales Data Methods =====
  getSalesData() { return this.getItem(this.keys.salesData) || []; }
  setSalesData(data) { return this.setItem(this.keys.salesData, data); }

  // Migration cleanup — the earlier "testing-in-liters" migration (v1) was
  // reverted per user feedback. If v1 ran and converted records to gross,
  // this runs once to restore them to net (liters = end - start - testing).
  _migrateTestingIncludedInLiters() {
    try {
      const V1_FLAG = 'mpump_mig_testing_in_liters_v1';
      const REVERT_FLAG = 'mpump_mig_testing_in_liters_revert_v1';
      const v1Ran = localStorage.getItem(nsKey(V1_FLAG)) === '1';
      const revertRan = localStorage.getItem(nsKey(REVERT_FLAG)) === '1';

      if (v1Ran && !revertRan) {
        const sales = this.getSalesData();
        let changed = false;
        sales.forEach((s) => {
          const testing = parseFloat(s.testing) || 0;
          if (testing <= 0) return;
          const start = parseFloat(s.startReading) || 0;
          const end = parseFloat(s.endReading) || 0;
          const rate = parseFloat(s.rate) || 0;
          const storedLiters = parseFloat(s.liters) || 0;
          const gross = end - start;
          const net = gross - testing;
          // Only revert rows that were migrated forward (currently at gross).
          if (Math.abs(storedLiters - gross) < 0.005 && Math.abs(storedLiters - net) > 0.005) {
            s.liters = parseFloat(net.toFixed(2));
            s.amount = parseFloat((net * rate).toFixed(2));
            changed = true;
          }
        });
        if (changed) this.setSalesData(sales);
      }
      // Mark as handled either way so we don't run again on every load.
      localStorage.setItem(nsKey(REVERT_FLAG), '1');
      localStorage.setItem(nsKey(V1_FLAG), '1');
    } catch (err) {
      console.warn('Testing migration revert failed:', err);
    }
  }
  addSaleRecord(saleData) {
    const sales = this.getSalesData();
    const newSale = {
      id: Date.now().toString(),
      date: saleData.date,
      nozzle: saleData.nozzle,
      fuelType: saleData.fuelType,
      startReading: parseFloat(saleData.startReading),
      endReading: parseFloat(saleData.endReading),
      liters: parseFloat(saleData.liters),
      rate: parseFloat(saleData.rate),
      amount: parseFloat(saleData.amount),
      type: 'cash',
      mpp: saleData.mpp || false,
      timestamp: new Date().toISOString()
    };
    sales.push(newSale);
    this.setSalesData(sales);
    if (this.onSyncCallback) this.onSyncCallback('create', 'sales', newSale.id, newSale);
    return newSale;
  }

  // ===== Credit Data Methods =====
  getCreditData() { return this.getItem(this.keys.creditData) || []; }
  setCreditData(data) { return this.setItem(this.keys.creditData, data); }
  addCreditRecord(creditData) {
    const credits = this.getCreditData();
    const newCredit = {
      id: Date.now().toString(),
      date: creditData.date,
      customerId: creditData.customerId,
      customerName: creditData.customerName,
      fuelEntries: creditData.fuelEntries || [],
      incomeEntries: creditData.incomeEntries || [],
      expenseEntries: creditData.expenseEntries || [],
      amount: parseFloat(creditData.amount),
      totalAmount: parseFloat(creditData.amount),
      vehicleNumber: creditData.vehicleNumber || 'N/A',
      fuelType: creditData.fuelType || (creditData.fuelEntries && creditData.fuelEntries[0] ? creditData.fuelEntries[0].fuelType : 'N/A'),
      liters: creditData.liters || (creditData.fuelEntries && creditData.fuelEntries[0] ? creditData.fuelEntries[0].liters : 0),
      rate: creditData.rate || (creditData.fuelEntries && creditData.fuelEntries[0] ? creditData.fuelEntries[0].rate : 0),
      dueDate: creditData.dueDate || creditData.date,
      status: creditData.status || 'pending',
      mpp: creditData.mpp || false,
      timestamp: new Date().toISOString()
    };
    credits.push(newCredit);
    this.setCreditData(credits);
    if (this.onSyncCallback) this.onSyncCallback('create', 'credits', newCredit.id, newCredit);
    return newCredit;
  }

  // ===== Income Methods =====
  getIncomeData() { return this.getItem(this.keys.incomeData) || []; }
  setIncomeData(data) { return this.setItem(this.keys.incomeData, data); }
  addIncomeRecord(incomeData) {
    const income = this.getIncomeData();
    const newIncome = {
      id: Date.now().toString(),
      date: incomeData.date,
      amount: parseFloat(incomeData.amount),
      description: incomeData.description || incomeData.category || 'Income',
      type: 'income',
      mpp: incomeData.mpp || false,
      timestamp: new Date().toISOString()
    };
    income.push(newIncome);
    this.setIncomeData(income);
    if (this.onSyncCallback) this.onSyncCallback('create', 'income', newIncome.id, newIncome);
    return newIncome;
  }

  // ===== Expense Methods =====
  getExpenseData() { return this.getItem(this.keys.expenseData) || []; }
  setExpenseData(data) { return this.setItem(this.keys.expenseData, data); }
  addExpenseRecord(expenseData) {
    const expenses = this.getExpenseData();
    const newExpense = {
      id: Date.now().toString(),
      date: expenseData.date,
      amount: parseFloat(expenseData.amount),
      description: expenseData.description || expenseData.category || 'Expense',
      type: 'expense',
      mpp: expenseData.mpp || false,
      timestamp: new Date().toISOString()
    };
    expenses.push(newExpense);
    this.setExpenseData(expenses);
    if (this.onSyncCallback) this.onSyncCallback('create', 'expense', newExpense.id, newExpense);
    return newExpense;
  }

  // ===== Fuel Settings =====
  getFuelSettings() { return this.getItem(this.keys.fuelSettings); }
  setFuelSettings(settings) {
    const result = this.setItem(this.keys.fuelSettings, settings);
    return result;
  }

  updateFuelRate(fuelType, rate, date = null) {
    if (date) return this.setRateForDate(fuelType, rate, date);
    const settings = this.getFuelSettings() || {};
    if (settings[fuelType]) {
      settings[fuelType].price = parseFloat(rate);
      this.setFuelSettings(settings);
      return true;
    }
    return false;
  }

  // ===== Date-specific rates =====
  getAllRates() { return this.getItem(this.keys.rates) || {}; }
  setAllRates(rates) { return this.setItem(this.keys.rates, rates); }
  setRateForDate(fuelType, rate, date) {
    const rates = this.getAllRates();
    if (!rates[date]) rates[date] = {};
    rates[date][fuelType] = parseFloat(rate);
    return this.setAllRates(rates);
  }
  getRatesForDate(date) {
    const rates = this.getAllRates();
    if (rates[date]) return rates[date];
    const allDates = Object.keys(rates).sort().reverse();
    const previousDate = allDates.find(d => d < date);
    if (previousDate) return rates[previousDate];
    return {};
  }
  getLastChangedRate(fuelType, beforeDate) {
    const rates = this.getAllRates();
    const allDates = Object.keys(rates).filter(d => d < beforeDate).sort().reverse();
    for (const date of allDates) {
      if (rates[date][fuelType] !== undefined) return rates[date][fuelType];
    }
    return null;
  }

  // ===== Filtering =====
  getDataByDate(dataType, date) {
    let data = [];
    switch (dataType) {
      case 'sales': data = this.getSalesData(); break;
      case 'credit': data = this.getCreditData(); break;
      case 'income': data = this.getIncomeData(); break;
      case 'expense': data = this.getExpenseData(); break;
    }
    if (!date) return data;
    return data.filter(item => item.date === date);
  }

  // ===== Delete helpers =====
  deleteSaleRecord(id) {
    const sales = this.getSalesData();
    const saleToDelete = sales.find(s => s.id === id);
    const updated = sales.filter(s => s.id !== id);
    this.setSalesData(updated);
    if (this.onSyncCallback) this.onSyncCallback('delete', 'sales', id, null);
    return true;
  }
  deleteCreditRecord(id) {
    const credits = this.getCreditData();
    const creditToDelete = credits.find(c => c.id === id);
    const updated = credits.filter(c => c.id !== id);
    this.setCreditData(updated);
    if (this.onSyncCallback) this.onSyncCallback('delete', 'credits', id, null);
    return true;
  }
  deleteIncomeRecord(id) {
    const income = this.getIncomeData();
    const rec = income.find(i => i.id === id);
    const updated = income.filter(i => i.id !== id);
    this.setIncomeData(updated);
    if (this.onSyncCallback) this.onSyncCallback('delete', 'income', id, null);
    return true;
  }
  deleteExpenseRecord(id) {
    const expenses = this.getExpenseData();
    const rec = expenses.find(e => e.id === id);
    const updated = expenses.filter(e => e.id !== id);
    this.setExpenseData(updated);
    if (this.onSyncCallback) this.onSyncCallback('delete', 'expense', id, null);
    return true;
  }

  // ===== Combined getter =====
  getIncomeExpenseData() {
    const income = this.getIncomeData();
    const expenses = this.getExpenseData();
    return [...income, ...expenses];
  }

  // ===== Update helpers =====
  updateSaleRecord(id, updatedData) {
    const sales = this.getSalesData();
    const idx = sales.findIndex(s => s.id === id);
    if (idx !== -1) {
      sales[idx] = { ...sales[idx], ...updatedData };
      this.setSalesData(sales);
      if (this.onSyncCallback) this.onSyncCallback('update', 'sales', id, sales[idx]);
      return sales[idx];
    }
    return null;
  }
  updateCreditRecord(id, updatedData) {
    const credits = this.getCreditData();
    const idx = credits.findIndex(c => c.id === id);
    if (idx !== -1) {
      const merged = { ...credits[idx], ...updatedData };

      // Keep legacy aggregate fields (liters / rate / fuelType) in sync with
      // the canonical fuelEntries[] array. Older parts of the app (PDF, report
      // preview, credit list) still read c.liters & c.rate directly, so we
      // must overwrite — not preserve — these on every update; otherwise an
      // edit that changes litres would leave stale values behind.
      if (Array.isArray(merged.fuelEntries) && merged.fuelEntries.length > 0) {
        const totalLiters = merged.fuelEntries.reduce(
          (s, e) => s + (parseFloat(e.liters) || 0), 0
        );
        merged.liters = totalLiters;
        // Single-fuel record: keep canonical rate & fuelType.
        // Multi-fuel record: rate is ambiguous — clear so UI shows "-".
        if (merged.fuelEntries.length === 1) {
          merged.rate = parseFloat(merged.fuelEntries[0].rate) || 0;
          merged.fuelType = merged.fuelEntries[0].fuelType || merged.fuelType;
        } else {
          merged.rate = 0;
        }
      } else if (updatedData && Object.prototype.hasOwnProperty.call(updatedData, 'fuelEntries')) {
        // Caller explicitly set fuelEntries to empty/undefined → reset legacy too
        merged.liters = 0;
        merged.rate = 0;
      }

      credits[idx] = merged;
      this.setCreditData(credits);
      if (this.onSyncCallback) this.onSyncCallback('update', 'credits', id, credits[idx]);
      return credits[idx];
    }
    return null;
  }
  updateIncomeRecord(id, updatedData) {
    const income = this.getIncomeData();
    const idx = income.findIndex(i => i.id === id);
    if (idx !== -1) {
      income[idx] = { ...income[idx], ...updatedData };
      this.setIncomeData(income);
      if (this.onSyncCallback) this.onSyncCallback('update', 'income', id, income[idx]);
      return income[idx];
    }
    return null;
  }
  updateExpenseRecord(id, updatedData) {
    const expenses = this.getExpenseData();
    const idx = expenses.findIndex(e => e.id === id);
    if (idx !== -1) {
      expenses[idx] = { ...expenses[idx], ...updatedData };
      this.setExpenseData(expenses);
      if (this.onSyncCallback) this.onSyncCallback('update', 'expense', id, expenses[idx]);
      return expenses[idx];
    }
    return null;
  }

  // ===== Backup/Export =====
  exportDataByDate(selectedDate) {
    const sales = this.getSalesData().filter(s => s.date === selectedDate).map(s => ({
      i: s.id, d: s.date, n: s.nozzle, f: s.fuelType, sr: s.startReading, er: s.endReading, l: s.liters, r: s.rate, a: s.amount, m: s.mpp
    }));
    const credits = this.getCreditData().filter(c => c.date === selectedDate).map(c => ({
      i: c.id, d: c.date, ci: c.customerId, cn: c.customerName, a: c.amount, m: c.mpp
    }));
    const income = this.getIncomeData().filter(i => i.date === selectedDate).map(i => ({
      i: i.id, d: i.date, ds: i.description, a: i.amount, m: i.mpp
    }));
    const expense = this.getExpenseData().filter(e => e.date === selectedDate).map(e => ({
      i: e.id, d: e.date, ds: e.description, a: e.amount, m: e.mpp
    }));
    const pay = this.getPayments().filter(p => p.date === selectedDate).map(p => ({
      i: p.id, d: p.date, ci: p.customerId, a: p.amount, m: p.mode
    }));
    const settle = this.getSettlements().filter(s => s.date === selectedDate).map(s => ({
      i: s.id, d: s.date, a: s.amount, ds: s.description, m: s.mpp
    }));
    const cust = this.getCustomers().map(c => ({ i: c.id, n: c.name, sb: c.startingBalance, mpp: c.isMPP }));
    const fuel = {};
    const fullFuel = this.getFuelSettings() || {};
    Object.keys(fullFuel).forEach(key => { fuel[key] = { p: fullFuel[key].price, n: fullFuel[key].nozzleCount }; });
    return { s: sales, c: credits, i: income, e: expense, p: pay, st: settle, f: fuel, cu: cust, dt: selectedDate, v: '2.1' };
  }

  exportAllData() {
    // Export 100% of all data
    const stockData = {};
    const fuelSettings = this.getFuelSettings() || {};
    Object.keys(fuelSettings).forEach(fuelType => {
      const storageKey = `${fuelType.toLowerCase()}StockData`;
      const data = this.getItem(storageKey);
      if (data) stockData[storageKey] = data;
    });

    return {
      // Core data
      salesData: this.getSalesData(),
      creditData: this.getCreditData(),
      incomeData: this.getIncomeData(),
      expenseData: this.getExpenseData(),
      customers: this.getCustomers(),
      payments: this.getPayments(),
      settlements: this.getSettlements(),
      // Settings & types
      fuelSettings: this.getFuelSettings(),
      settlementTypes: this.getSettlementTypes(),
      incomeCategories: this.getIncomeCategories(),
      expenseCategories: this.getExpenseCategories(),
      rates: this.getAllRates(),
      // History
      incomeDescHistory: this.getItem(this.keys.incomeDescHistory) || [],
      expenseDescHistory: this.getItem(this.keys.expenseDescHistory) || [],
      cashOwnerEntries: this.getCashOwnerEntries(),
      // Stock
      stockData,
      // App settings
      contactInfo: (() => { try { const v = localStorage.getItem(nsKey('mpump_contact_info')); return v ? JSON.parse(v) : null; } catch(e) { return null; } })(),
      notes: localStorage.getItem(nsKey('mpp_notes')) || '',
      onlineUrl: localStorage.getItem(nsKey('mpump_online_url')) || '',
      autoBackupSettings: (() => { try { const v = localStorage.getItem(nsKey('mpump_auto_backup_settings')); return v ? JSON.parse(v) : null; } catch(e) { return null; } })(),
      weeklyBackupSettings: (() => { try { const v = localStorage.getItem(nsKey('mpump_auto_backup_weekly_settings')); return v ? JSON.parse(v) : null; } catch(e) { return null; } })(),
      appPreferences: {
        textSize: localStorage.getItem(nsKey('appTextSize')) || '100',
        theme: localStorage.getItem(nsKey('appTheme')) || 'light'
      },
      exportDate: new Date().toISOString(),
      version: '2.2'
    };
  }

  importAllData(data) {
    try {
      // Core data - full overwrite
      if (data.salesData) this.setSalesData(data.salesData);
      if (data.creditData) this.setCreditData(data.creditData);
      if (data.incomeData) this.setIncomeData(data.incomeData);
      if (data.expenseData) this.setExpenseData(data.expenseData);
      if (data.customers) this.setCustomers(data.customers);
      if (data.payments) this.setPayments(data.payments);
      if (data.settlements) this.setSettlements(data.settlements);
      // Settings & types
      if (data.fuelSettings) this.setFuelSettings(data.fuelSettings);
      if (data.settlementTypes) this.setSettlementTypes(data.settlementTypes);
      if (data.incomeCategories) this.setIncomeCategories(data.incomeCategories);
      if (data.expenseCategories) this.setExpenseCategories(data.expenseCategories);
      if (data.rates) this.setAllRates(data.rates);
      // History
      if (data.incomeDescHistory) this.setItem(this.keys.incomeDescHistory, data.incomeDescHistory);
      if (data.expenseDescHistory) this.setItem(this.keys.expenseDescHistory, data.expenseDescHistory);
      if (data.cashOwnerEntries) this.setCashOwnerEntries(data.cashOwnerEntries);
      // Stock
      if (data.stockData) { Object.keys(data.stockData).forEach(key => { this.setItem(key, data.stockData[key]); }); }
      // App settings
      if (data.contactInfo) localStorage.setItem(nsKey('mpump_contact_info'), JSON.stringify(data.contactInfo));
      if (data.notes !== undefined) localStorage.setItem(nsKey('mpp_notes'), data.notes);
      if (data.onlineUrl !== undefined) localStorage.setItem(nsKey('mpump_online_url'), data.onlineUrl);
      if (data.autoBackupSettings) localStorage.setItem(nsKey('mpump_auto_backup_settings'), JSON.stringify(data.autoBackupSettings));
      if (data.weeklyBackupSettings) localStorage.setItem(nsKey('mpump_auto_backup_weekly_settings'), JSON.stringify(data.weeklyBackupSettings));
      if (data.appPreferences) {
        if (data.appPreferences.textSize) localStorage.setItem(nsKey('appTextSize'), data.appPreferences.textSize);
        if (data.appPreferences.theme) localStorage.setItem(nsKey('appTheme'), data.appPreferences.theme);
      }
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }

  mergeAllData(importedData) {
    try {
      console.log('mergeAllData: Starting merge...');
      console.log('mergeAllData: Namespace:', ACTIVE_NAMESPACE);
      console.log('mergeAllData: Import keys:', Object.keys(importedData));
      
      // Merge arrays by ID - current data takes preference (existing items kept, new items added)
      const mergeArrays = (existing, incoming) => {
        if (!Array.isArray(existing)) existing = [];
        if (!Array.isArray(incoming)) incoming = [];
        const existingIds = new Set(existing.map(item => item.id));
        const newItems = incoming.filter(item => !existingIds.has(item.id));
        console.log('mergeAllData: existing=' + existing.length + ', incoming=' + incoming.length + ', adding=' + newItems.length);
        return [...existing, ...newItems];
      };

      // Core data - merge by ID (current data kept, new records added)
      if (importedData.salesData) this.setSalesData(mergeArrays(this.getSalesData(), importedData.salesData));
      if (importedData.creditData) this.setCreditData(mergeArrays(this.getCreditData(), importedData.creditData));
      if (importedData.incomeData) this.setIncomeData(mergeArrays(this.getIncomeData(), importedData.incomeData));
      if (importedData.expenseData) this.setExpenseData(mergeArrays(this.getExpenseData(), importedData.expenseData));
      if (importedData.payments) this.setPayments(mergeArrays(this.getPayments(), importedData.payments));
      if (importedData.settlements) this.setSettlements(mergeArrays(this.getSettlements(), importedData.settlements));

      // Customers - merge by ID AND by name (case-insensitive) to avoid duplicates across devices
      if (importedData.customers) {
        const existing = this.getCustomers() || [];
        const existingIds = new Set(existing.map(c => c.id));
        const existingNames = new Set(existing.map(c => (c.name || '').trim().toLowerCase()));
        const additions = (importedData.customers || []).filter(c =>
          !existingIds.has(c.id) &&
          !existingNames.has((c.name || '').trim().toLowerCase())
        );
        if (additions.length) {
          const merged = [...existing, ...additions].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          this.setCustomers(merged);
          console.log('mergeAllData: customers added=' + additions.length);
        }
      }

      // Settlement types - merge by ID AND by name (case-insensitive)
      if (importedData.settlementTypes) {
        const existing = this.getSettlementTypes() || [];
        const existingIds = new Set(existing.map(t => t.id));
        const existingNames = new Set(existing.map(t => (t.name || '').trim().toLowerCase()));
        const additions = (importedData.settlementTypes || []).filter(t =>
          !existingIds.has(t.id) &&
          !existingNames.has((t.name || '').trim().toLowerCase())
        );
        if (additions.length) {
          this.setSettlementTypes([...existing, ...additions]);
          console.log('mergeAllData: settlementTypes added=' + additions.length);
        }
      }

      // Income/Expense categories - merge by ID (existing tolerance)
      if (importedData.incomeCategories) this.setIncomeCategories(mergeArrays(this.getIncomeCategories(), importedData.incomeCategories));
      if (importedData.expenseCategories) this.setExpenseCategories(mergeArrays(this.getExpenseCategories(), importedData.expenseCategories));

      // Fuel settings - DEEP MERGE:
      //   - Existing fuel types kept as-is (price/nozzleCount not overwritten)
      //   - New fuel types from backup (e.g., "Power") are ADDED with their nozzleCount/price
      if (importedData.fuelSettings && typeof importedData.fuelSettings === 'object') {
        const current = this.getFuelSettings() || {};
        const merged = { ...current };
        let added = 0;
        Object.keys(importedData.fuelSettings).forEach(ft => {
          if (!merged[ft]) {
            merged[ft] = importedData.fuelSettings[ft];
            added += 1;
          }
        });
        if (added > 0 || Object.keys(current).length === 0) {
          this.setFuelSettings(merged);
          console.log('mergeAllData: fuelSettings new types added=' + added);
        }
      }

      // Rates - merge by date key (current takes preference)
      if (importedData.rates) {
        const currentRates = this.getAllRates() || {};
        const mergedRates = { ...importedData.rates, ...currentRates };
        this.setAllRates(mergedRates);
      }

      // Description history - merge unique values
      if (importedData.incomeDescHistory) {
        const current = this.getItem(this.keys.incomeDescHistory) || [];
        const merged = [...new Set([...current, ...importedData.incomeDescHistory])];
        this.setItem(this.keys.incomeDescHistory, merged);
      }
      if (importedData.expenseDescHistory) {
        const current = this.getItem(this.keys.expenseDescHistory) || [];
        const merged = [...new Set([...current, ...importedData.expenseDescHistory])];
        this.setItem(this.keys.expenseDescHistory, merged);
      }

      // Stock data - merge by date (current takes preference)
      if (importedData.stockData) {
        Object.keys(importedData.stockData).forEach(key => {
          const existing = this.getItem(key);
          if (!existing) {
            this.setItem(key, importedData.stockData[key]);
          } else {
            const merged = { ...importedData.stockData[key], ...existing };
            this.setItem(key, merged);
          }
        });
      }

      // App settings - keep current if exists, use imported only if current is missing
      if (importedData.contactInfo && !localStorage.getItem(nsKey('mpump_contact_info'))) localStorage.setItem(nsKey('mpump_contact_info'), JSON.stringify(importedData.contactInfo));
      if (importedData.notes !== undefined && !localStorage.getItem(nsKey('mpp_notes'))) localStorage.setItem(nsKey('mpp_notes'), importedData.notes);
      if (importedData.onlineUrl !== undefined && !localStorage.getItem(nsKey('mpump_online_url'))) localStorage.setItem(nsKey('mpump_online_url'), importedData.onlineUrl);
      if (importedData.autoBackupSettings && !localStorage.getItem(nsKey('mpump_auto_backup_settings'))) localStorage.setItem(nsKey('mpump_auto_backup_settings'), JSON.stringify(importedData.autoBackupSettings));
      if (importedData.weeklyBackupSettings && !localStorage.getItem(nsKey('mpump_auto_backup_weekly_settings'))) localStorage.setItem(nsKey('mpump_auto_backup_weekly_settings'), JSON.stringify(importedData.weeklyBackupSettings));
      if (importedData.appPreferences) {
        if (importedData.appPreferences.textSize && !localStorage.getItem(nsKey('appTextSize'))) localStorage.setItem(nsKey('appTextSize'), importedData.appPreferences.textSize);
        if (importedData.appPreferences.theme && !localStorage.getItem(nsKey('appTheme'))) localStorage.setItem(nsKey('appTheme'), importedData.appPreferences.theme);
      }

      console.log('mergeAllData: Merge completed successfully');
      return true;
    } catch (error) {
      console.error('Failed to merge data:', error);
      return false;
    }
  }

  // Clear all data in current namespace only
  clearAllData() {
    const prefix = ACTIVE_NAMESPACE || '';
    const keys = Object.keys(localStorage);
    keys.forEach((k) => { if (k.startsWith(prefix)) localStorage.removeItem(k); });
    this.initializeDefaultData();
  }

  // Storage info (current namespace only)
  getStorageInfo() {
    const prefix = ACTIVE_NAMESPACE || '';
    let totalSize = 0;
    let itemCount = 0;
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(prefix)) {
        totalSize += (localStorage.getItem(k) || '').length;
        if (k.includes('mpump_')) itemCount += 1;
      }
    }
    return { totalSize, itemCount, maxSize: 5 * 1024 * 1024, usagePercent: (totalSize / (5 * 1024 * 1024)) * 100 };
  }

  // Export only the data that falls within a single financial year (1 Apr <fyStart>
  // through 31 Mar <fyStart+1>). Useful for archival / per-year backups so the
  // exported JSON stays small as data accumulates.
  // fyStart: integer year representing the start of the FY (e.g. 2024 -> 1 Apr 2024).
  exportFinancialYearData(fyStart) {
    const fromDate = `${fyStart}-04-01`;
    const toDate = `${fyStart + 1}-03-31`;
    const inRange = (d) => typeof d === 'string' && d >= fromDate && d <= toDate;

    const stockData = {};
    const fuelSettings = this.getFuelSettings() || {};
    Object.keys(fuelSettings).forEach(fuelType => {
      const storageKey = `${fuelType.toLowerCase()}StockData`;
      const all = this.getItem(storageKey);
      if (all && typeof all === 'object') {
        // stockData entries are keyed by date — keep only matching ones
        const filtered = {};
        Object.keys(all).forEach(dateKey => {
          if (inRange(dateKey)) filtered[dateKey] = all[dateKey];
        });
        if (Object.keys(filtered).length) stockData[storageKey] = filtered;
      }
    });

    return {
      // Date-bounded core data
      salesData: this.getSalesData().filter(r => inRange(r.date)),
      creditData: this.getCreditData().filter(r => inRange(r.date)),
      incomeData: this.getIncomeData().filter(r => inRange(r.date)),
      expenseData: this.getExpenseData().filter(r => inRange(r.date)),
      payments: this.getPayments().filter(r => inRange(r.date)),
      settlements: this.getSettlements().filter(r => inRange(r.date)),
      // Reference data – always include in full so the backup is self-contained
      customers: this.getCustomers(),
      fuelSettings: this.getFuelSettings(),
      settlementTypes: this.getSettlementTypes(),
      incomeCategories: this.getIncomeCategories(),
      expenseCategories: this.getExpenseCategories(),
      rates: this.getAllRates(),
      stockData,
      // Metadata
      financialYear: { from: fromDate, to: toDate, label: `FY ${fyStart}-${fyStart + 1}` },
      exportDate: new Date().toISOString(),
      version: '2.2-fy',
    };
  }

  // ===== Customers =====
  getCustomers() { return this.getItem(this.keys.customers) || []; }
  setCustomers(customers) { return this.setItem(this.keys.customers, customers); }
  addCustomer(name, startingBalance = 0, isMPP = false) {
    const customers = this.getCustomers();
    
    // Check for duplicate name (case-insensitive, trimmed)
    const trimmedName = name.trim();
    const isDuplicate = customers.some(c => 
      c.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error('Duplicate customer name. Please use a unique name');
    }
    
    if (isMPP) {
      const existingMPP = customers.find(c => c.isMPP === true);
      if (existingMPP) throw new Error('A Manager Petrol Pump customer already exists. Only one MPP customer is allowed.');
    }
    const newCustomer = { id: Date.now().toString(), name: trimmedName, startingBalance: parseFloat(startingBalance) || 0, isMPP: isMPP || false, created_at: new Date().toISOString() };
    customers.push(newCustomer);
    customers.sort((a, b) => a.name.localeCompare(b.name));
    this.setCustomers(customers);
    if (this.onSyncCallback) this.onSyncCallback('create', 'customers', newCustomer.id, newCustomer);
    return newCustomer;
  }
  deleteCustomer(id) {
    const customers = this.getCustomers();
    const customerToDelete = customers.find(c => c.id === id);
    const updated = customers.filter(c => c.id !== id);
    this.setCustomers(updated);
    if (this.onSyncCallback) this.onSyncCallback('delete', 'customers', id, null);
    return true;
  }
  updateCustomer(id, startingBalance, isMPP, newName) {
    const customers = this.getCustomers();
    const currentCustomer = customers.find(c => c.id === id);
    
    // Check for duplicate name if name is being changed (case-insensitive, trimmed)
    if (newName !== undefined) {
      const trimmedNewName = newName.trim();
      const isDuplicate = customers.some(c => 
        c.id !== id && c.name.trim().toLowerCase() === trimmedNewName.toLowerCase()
      );
      if (isDuplicate) {
        throw new Error('Duplicate customer name. Please use a unique name');
      }
    }
    
    if (isMPP === true) {
      const existingMPP = customers.find(c => c.isMPP === true && c.id !== id);
      if (existingMPP) throw new Error('A Manager Petrol Pump customer already exists. Only one MPP customer is allowed.');
    }
    const updated = customers.map(c => {
      if (c.id === id) {
        const u = { ...c, startingBalance: parseFloat(startingBalance) || 0 };
        if (isMPP !== undefined) u.isMPP = isMPP;
        if (newName !== undefined) u.name = newName.trim();
        return u;
      }
      return c;
    });
    this.setCustomers(updated);
    const updatedCustomer = updated.find(c => c.id === id);
    if (this.onSyncCallback) this.onSyncCallback('update', 'customers', id, updatedCustomer);
    return updatedCustomer;
  }

  // Visibility
  isMPPVisible() { return this.getCustomers().some(c => c.isMPP === true); }

  // ===== Payments =====
  getPayments() { return this.getItem(this.keys.payments) || []; }
  setPayments(payments) { return this.setItem(this.keys.payments, payments); }
  addPayment(paymentData) {
    const payments = this.getPayments();
    const newPayment = { id: Date.now().toString(), customerId: paymentData.customerId, customerName: paymentData.customerName, amount: parseFloat(paymentData.amount), date: paymentData.date, mode: paymentData.mode || 'cash', paymentType: paymentData.paymentType || '', settlementType: paymentData.settlementType || '', timestamp: new Date().toISOString(), linkedMPPCreditId: paymentData.linkedMPPCreditId || null, linkedMPPSettlementId: paymentData.linkedMPPSettlementId || null, isAutoMPPTracking: paymentData.isAutoMPPTracking || false, description: paymentData.description || null };
    payments.push(newPayment);
    this.setPayments(payments);
    if (this.onSyncCallback) this.onSyncCallback('create', 'payments', newPayment.id, newPayment);
    return newPayment;
  }
  updatePayment(id, paymentData) {
    const payments = this.getPayments();
    const index = payments.findIndex(p => p.id === id);
    if (index !== -1) {
      payments[index] = { ...payments[index], customerId: paymentData.customerId, customerName: paymentData.customerName, amount: parseFloat(paymentData.amount), date: paymentData.date, mode: paymentData.mode || payments[index].mode || 'cash', paymentType: paymentData.paymentType || payments[index].paymentType || '', settlementType: paymentData.settlementType || payments[index].settlementType || '', timestamp: new Date().toISOString() };
      this.setPayments(payments);
      if (this.onSyncCallback) this.onSyncCallback('update', 'payments', id, payments[index]);
      return payments[index];
    }
    return null;
  }
  deletePayment(id) {
    const payments = this.getPayments();
    const paymentToDelete = payments.find(p => p.id === id);
    const updated = payments.filter(p => p.id !== id);
    this.setPayments(updated);
    if (this.onSyncCallback) this.onSyncCallback('delete', 'payments', id, null);
    return true;
  }

  // ===== Categories =====
  getIncomeCategories() { return this.getItem(this.keys.incomeCategories) || []; }
  setIncomeCategories(categories) { return this.setItem(this.keys.incomeCategories, categories); }
  addIncomeCategory(name) { const categories = this.getIncomeCategories(); const newCategory = { id: Date.now().toString(), name }; categories.push(newCategory); categories.sort((a,b)=>a.name.localeCompare(b.name)); this.setIncomeCategories(categories); if (this.onSyncCallback) this.onSyncCallback('create', 'incomeCategories', newCategory.id, newCategory); return newCategory; }
  deleteIncomeCategory(id) { const categories = this.getIncomeCategories(); const updated = categories.filter(c => c.id !== id); this.setIncomeCategories(updated); if (this.onSyncCallback) this.onSyncCallback('delete', 'incomeCategories', id, null); return true; }
  updateIncomeCategory(id, name) { const categories = this.getIncomeCategories(); const updated = categories.map(c => c.id === id ? { ...c, name } : c); updated.sort((a,b)=>a.name.localeCompare(b.name)); this.setIncomeCategories(updated); const updatedCategory = updated.find(c => c.id === id); if (this.onSyncCallback) this.onSyncCallback('update', 'incomeCategories', id, updatedCategory); return updatedCategory; }

  getExpenseCategories() { return this.getItem(this.keys.expenseCategories) || []; }
  setExpenseCategories(categories) { return this.setItem(this.keys.expenseCategories, categories); }
  addExpenseCategory(name) { const categories = this.getExpenseCategories(); const newCategory = { id: Date.now().toString(), name }; categories.push(newCategory); categories.sort((a,b)=>a.name.localeCompare(b.name)); this.setExpenseCategories(categories); if (this.onSyncCallback) this.onSyncCallback('create', 'expenseCategories', newCategory.id, newCategory); return newCategory; }
  deleteExpenseCategory(id) { const categories = this.getExpenseCategories(); const updated = categories.filter(c => c.id !== id); this.setExpenseCategories(updated); if (this.onSyncCallback) this.onSyncCallback('delete', 'expenseCategories', id, null); return true; }
  updateExpenseCategory(id, name) { const categories = this.getExpenseCategories(); const updated = categories.map(c => c.id === id ? { ...c, name } : c); updated.sort((a,b)=>a.name.localeCompare(b.name)); this.setExpenseCategories(updated); const updatedCategory = updated.find(c => c.id === id); if (this.onSyncCallback) this.onSyncCallback('update', 'expenseCategories', id, updatedCategory); return updatedCategory; }

  // ===== Settlements =====
  getSettlements() { return this.getItem(this.keys.settlements) || []; }
  setSettlements(settlements) { return this.setItem(this.keys.settlements, settlements); }
  addSettlement(settlementData) {
    const settlements = this.getSettlements();
    const newSettlement = { id: Date.now().toString(), date: settlementData.date, amount: parseFloat(settlementData.amount), description: settlementData.description || '', mpp: settlementData.mpp || false, timestamp: new Date().toISOString() };
    settlements.push(newSettlement);
    this.setSettlements(settlements);
    if (this.onSyncCallback) this.onSyncCallback('create', 'settlements', newSettlement.id, newSettlement);
    return newSettlement;
  }
  updateSettlement(id, settlementData) {
    const settlements = this.getSettlements();
    const index = settlements.findIndex(s => s.id === id);
    if (index !== -1) {
      settlements[index] = { ...settlements[index], date: settlementData.date, amount: parseFloat(settlementData.amount), description: settlementData.description || '', mpp: settlementData.mpp !== undefined ? settlementData.mpp : settlements[index].mpp, timestamp: new Date().toISOString() };
      this.setSettlements(settlements);
      if (this.onSyncCallback) this.onSyncCallback('update', 'settlements', id, settlements[index]);
      return settlements[index];
    }
    return null;
  }
  deleteSettlement(id) {
    const settlements = this.getSettlements();
    const toDelete = settlements.find(s => s.id === id);
    const updated = settlements.filter(s => s.id !== id);
    this.setSettlements(updated);
    if (this.onSyncCallback) this.onSyncCallback('delete', 'settlements', id, null);
    return true;
  }

  // ===== Settlement Types =====
  getSettlementTypes() { return this.getItem(this.keys.settlementTypes) || []; }
  setSettlementTypes(types) { return this.setItem(this.keys.settlementTypes, types); }
  addSettlementType(name) { const types = this.getSettlementTypes(); const newType = { id: Date.now().toString(), name }; types.push(newType); types.sort((a,b)=>a.name.localeCompare(b.name)); this.setSettlementTypes(types); return newType; }
  deleteSettlementType(id) { const types = this.getSettlementTypes(); const target = types.find(t => t.id === id); if (target && target.builtin) return false; const updated = types.filter(t => t.id !== id); this.setSettlementTypes(updated); return true; }
  updateSettlementType(id, name) { const types = this.getSettlementTypes(); const updated = types.map(t => t.id === id ? { ...t, name } : t); types.sort((a,b)=>a.name.localeCompare(b.name)); this.setSettlementTypes(updated); return updated.find(t => t.id === id); }

  // ===== Cash Owner Tally manual entries (withdrawals from owner cash) =====
  getCashOwnerEntries() { return this.getItem(this.keys.cashOwnerEntries) || []; }
  setCashOwnerEntries(entries) { return this.setItem(this.keys.cashOwnerEntries, entries); }
  addCashOwnerEntry(entry) {
    const list = this.getCashOwnerEntries();
    const newEntry = {
      id: Date.now().toString(),
      date: entry.date,
      description: (entry.description || '').trim(),
      amount: parseFloat(entry.amount) || 0,
      timestamp: new Date().toISOString(),
    };
    list.push(newEntry);
    this.setCashOwnerEntries(list);
    return newEntry;
  }
  deleteCashOwnerEntry(id) {
    const list = this.getCashOwnerEntries().filter(e => e.id !== id);
    this.setCashOwnerEntries(list);
    return true;
  }

  // ===== Description history =====
  getIncomeDescHistory() { return JSON.parse(localStorage.getItem(nsKey(this.keys.incomeDescHistory)) || '[]'); }
  addIncomeDescHistory(description) { if (!description || !description.trim()) return; const history = this.getIncomeDescHistory(); const trimmed = description.trim(); if (history.includes(trimmed)) return; history.unshift(trimmed); if (history.length > 20) history.splice(20); localStorage.setItem(nsKey(this.keys.incomeDescHistory), JSON.stringify(history)); }
  deleteIncomeDescHistory(description) { const history = this.getIncomeDescHistory(); const updated = history.filter(item => item !== description); localStorage.setItem(nsKey(this.keys.incomeDescHistory), JSON.stringify(updated)); }

  getExpenseDescHistory() { return JSON.parse(localStorage.getItem(nsKey(this.keys.expenseDescHistory)) || '[]'); }
  addExpenseDescHistory(description) { if (!description || !description.trim()) return; const history = this.getExpenseDescHistory(); const trimmed = description.trim(); if (history.includes(trimmed)) return; history.unshift(trimmed); if (history.length > 20) history.splice(20); localStorage.setItem(nsKey(this.keys.expenseDescHistory), JSON.stringify(history)); }
  deleteExpenseDescHistory(description) { const history = this.getExpenseDescHistory(); const updated = history.filter(item => item !== description); localStorage.setItem(nsKey(this.keys.expenseDescHistory), JSON.stringify(updated)); }

  // Pro mode
  isProModeEnabled() { return localStorage.getItem(nsKey('mpump_pro_mode')) === 'true'; }
}

// Export singleton instance
export const localStorageService = new LocalStorageService();
export default localStorageService;

// Export utility + namespace helpers
export const setStorageNamespace = (userId) => localStorageService.setNamespace(userId);
export const clearStorageNamespace = () => localStorageService.clearNamespace();
export const exportAllData = () => localStorageService.exportAllData();
export const importAllData = (data) => localStorageService.importAllData(data);
export const mergeAllData = (data) => localStorageService.mergeAllData(data);
