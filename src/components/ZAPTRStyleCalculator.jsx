import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { 
  Calculator, 
  CreditCard, 
  TrendingDown, 
  Moon,
  Sun,
  Fuel,
  IndianRupee,
  TrendingUp,
  Settings,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Share2,
  Receipt,
  Plus,
  Minus,
  Users,
  Wallet,
  Package,
  DollarSign,
  ArrowRightLeft
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import useAutoBackup from '../hooks/use-auto-backup';
import { useAutoBackupWeekly } from '../hooks/use-auto-backup-weekly';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import SalesTracker from './SalesTracker';
import CreditSales from './CreditSales';
import IncomeExpense from './IncomeExpense';
import Settlement from './Settlement';
import PriceConfiguration from './PriceConfiguration';
import HeaderSettings from './HeaderSettings';
import UnifiedRecords from './UnifiedRecords';
import CustomerManagement from './CustomerManagement';
import PaymentReceived from './PaymentReceived';
import CreditSalesManagement from './CreditSalesManagement';
import OutstandingReport from './OutstandingReport';
import OutstandingPDFReport from './OutstandingPDFReport';
import CustomerInitialBalance from './CustomerInitialBalance';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, syncService } from '../services/firebase';
import { Cloud, CloudOff, RefreshCw, LogIn, LogOut, CheckCircle, Smartphone } from 'lucide-react';
import SalesReport from './SalesReport';
import CashOwnerTally from './CashOwnerTally';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import {
  SortableTab,
  loadBalanceTabOrder,
  saveBalanceTabOrder,
} from './SortableTab';
import CustomerLedger from './CustomerLedger';
import BankSettlement from './BankSettlement';
// Anonymous mode: LoginScreen removed
import MPPStock from './MPPStock';
import DSRReport from './DSRReport';
import localStorageService from '../services/localStorage';

// Helpers used by the live Reports preview AND the generated PDFs / HTML print
// so the Credit table's "Income/Expense" column shows a consistent value.
// Returns a signed total (income − expense) of all attached entries.
const creditNetIncomeExpense = (credit) => {
  const inc = (credit?.incomeEntries || []).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const exp = (credit?.expenseEntries || []).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  return inc - exp;
};

// Pretty format for the column: "+300.00" / "-100.00" / "0.00".
const formatCreditIE = (credit) => {
  const net = creditNetIncomeExpense(credit);
  if (net === 0) return '0.00';
  const sign = net > 0 ? '+' : '-';
  return `${sign}${Math.abs(net).toFixed(2)}`;
};

// Inline Reports tab — date picker with Share/PDF/Copy + live HTML preview of the PDF
const ReportPreviewTab = ({
  isDarkMode, selectedDate, setSelectedDate, formatDisplayDate,
  goToPreviousDay, goToNextDay, generateDirectPDF, copyToClipboard,
  stats, salesData, creditData, settlementData, incomeData, expenseData, payments, fuelSettings
}) => {
  const daySales = salesData.filter(s => s.date === selectedDate);
  const dayCredits = creditData.filter(c => c.date === selectedDate);
  const daySettlements = settlementData.filter(s => s.date === selectedDate);
  const dayIncome = incomeData.filter(i => i.date === selectedDate);
  const dayExpenses = expenseData.filter(e => e.date === selectedDate);
  const dayReceipts = payments.filter(p => p.date === selectedDate);

  const matchR = (p, kw) => {
    const st = (p.settlementType || '').toLowerCase();
    const m = (p.mode || '').toLowerCase();
    const pt = (p.paymentType || '').toLowerCase();
    return st.includes(kw) || m.includes(kw) || pt === kw;
  };
  const sumSett = (kw) => daySettlements
    .filter(s => s.description && s.description.toLowerCase().includes(kw))
    .reduce((s, v) => s + v.amount, 0);
  const sumRec = (kw) => dayReceipts.filter(p => matchR(p, kw)).reduce((s, p) => s + p.amount, 0);
  const cashT = sumSett('cash') + sumRec('cash');
  const cardT = sumSett('card') + sumRec('card');
  const paytmT = sumSett('paytm') + sumRec('paytm');
  const phonepeT = sumSett('phonepe') + sumRec('phonepe');
  const dtpT = sumSett('dtp') + sumRec('dtp');
  const bankTotal = cashT + cardT + paytmT + phonepeT + dtpT;

  const cellBase = 'px-2 py-1 border text-xs';
  const thBase = `${cellBase} font-bold ${isDarkMode ? 'border-gray-600 bg-gray-800 text-white' : 'border-slate-300 bg-slate-100 text-slate-800'}`;
  const tdBase = `${cellBase} ${isDarkMode ? 'border-gray-600 text-gray-200' : 'border-slate-300 text-slate-800'}`;
  const tdRight = `${tdBase} text-right`;
  const tdCenter = `${tdBase} text-center`;

  const cardCls = `rounded-lg border p-3 mb-3 ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-slate-200'}`;

  return (
    <div data-testid="reports-view">
      {/* Operating Date header (identical layout to main summary) */}
      <div className={cardCls}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Calendar className={`w-5 h-5 sm:w-6 sm:h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <div className="flex-1 min-w-0">
              <Label className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                Operating Date
              </Label>
              <div className={`text-sm sm:text-xl font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                {formatDisplayDate(selectedDate)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateDirectPDF('share')}
              data-testid="reports-share-btn"
              className={`text-xs h-7 px-2 ${isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
              title="Share PDF"
              aria-label="Share PDF"
            >
              <Share2 className="w-3.5 h-3.5 mr-1" />
              S
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateDirectPDF('open')}
              data-testid="reports-pdf-btn"
              className={`text-xs h-7 px-2 ${isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
            >
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              data-testid="reports-copy-btn"
              className={`text-xs h-7 px-2 ${isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
            >
              Copy
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 w-full mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousDay}
            className={`h-8 w-8 sm:h-10 sm:w-10 p-0 flex-shrink-0 ${isDarkMode ? 'border-gray-600 hover:bg-gray-700' : ''}`}
            aria-label="Previous day"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            data-testid="reports-date-input"
            className={`flex-1 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextDay}
            className={`h-8 w-8 sm:h-10 sm:w-10 p-0 flex-shrink-0 ${isDarkMode ? 'border-gray-600 hover:bg-gray-700' : ''}`}
            aria-label="Next day"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Report preview (mirrors PDF layout) */}
      <div className={cardCls}>
        <div className={`flex items-center justify-between px-3 py-2 mb-3 rounded ${isDarkMode ? 'bg-gray-900' : 'bg-slate-700'} text-white`}>
          <div className="font-bold text-sm">Manager Pump</div>
          <div className="text-xs">Date: {selectedDate}</div>
        </div>

        {fuelSettings && (
          <div className={`text-xs mb-2 ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>
            <span className="font-semibold">STOCK: </span>
            {Object.keys(fuelSettings).map(ft => {
              const sd = localStorageService.getItem(ft.toLowerCase() + 'StockData');
              const ss = (sd && sd[selectedDate]) ? (sd[selectedDate].startStock || 0) : 0;
              return `${ft}-${ss.toFixed(0)} L`;
            }).join(', ')}
          </div>
        )}
        {fuelSettings && (
          <div className={`text-xs mb-3 ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>
            <span className="font-semibold">FUEL SALES: </span>
            {Object.keys(fuelSettings).map(ft => {
              const fd = stats.fuelSalesByType[ft] || { liters: 0 };
              return `${ft}-${fd.liters.toFixed(0)} L`;
            }).join(', ')}
          </div>
        )}

        {/* Summary table */}
        <table className="w-full border-collapse mb-3">
          <thead>
            <tr>
              <th className={thBase}>Category</th>
              <th className={`${thBase} text-right`}>Litres</th>
              <th className={`${thBase} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className={tdBase}>Fuel Sales</td><td className={tdRight}>{stats.totalLiters.toFixed(2)}</td><td className={tdRight}>{stats.totalFuelAmount.toFixed(2)}</td></tr>
            <tr><td className={tdBase}>Credit Sales</td><td className={tdRight}>{stats.creditLiters.toFixed(2)}</td><td className={tdRight}>{stats.creditAmount.toFixed(2)}</td></tr>
            <tr><td className={tdBase}>Settlement</td><td className={tdRight}>-</td><td className={tdRight}>{stats.totalSettlement.toFixed(2)}</td></tr>
            <tr><td className={tdBase}>Income</td><td className={tdRight}>-</td><td className={tdRight}>{stats.otherIncome.toFixed(2)}</td></tr>
            <tr><td className={tdBase}>Expenses</td><td className={tdRight}>-</td><td className={tdRight}>{stats.totalExpenses.toFixed(2)}</td></tr>
            <tr><td className={tdBase}>Cash in Hand</td><td className={tdRight}>-</td><td className={tdRight}>{stats.cashInHand.toFixed(2)}</td></tr>
          </tbody>
        </table>

        {/* Sales Records */}
        {daySales.length > 0 && (
          <table className="w-full border-collapse mb-3">
            <thead><tr>
              <th className={thBase}>#</th><th className={thBase}>Description</th>
              <th className={`${thBase} text-right`}>Start</th><th className={`${thBase} text-right`}>End</th>
              <th className={`${thBase} text-right`}>Test</th><th className={`${thBase} text-right`}>Rate</th>
              <th className={`${thBase} text-right`}>Litres</th><th className={`${thBase} text-right`}>Amount</th>
            </tr></thead>
            <tbody>
              {daySales.map((s, i) => (
                <tr key={s.id || `s-${i}`}>
                  <td className={tdCenter}>{i + 1}</td>
                  <td className={tdBase}>{s.nozzle} - {s.fuelType}</td>
                  <td className={tdRight}>{s.startReading}</td>
                  <td className={tdRight}>{s.endReading}</td>
                  <td className={tdRight}>{s.testing || 0}</td>
                  <td className={tdRight}>{s.rate}</td>
                  <td className={tdRight}>{s.liters.toFixed(2)}</td>
                  <td className={tdRight}>{s.amount.toFixed(2)}</td>
                </tr>
              ))}
              <tr><td colSpan={6} className={`${tdBase} font-bold`}>Total</td><td className={`${tdRight} font-bold`}>{stats.totalLiters.toFixed(2)}</td><td className={`${tdRight} font-bold`}>{stats.totalFuelAmount.toFixed(2)}</td></tr>
            </tbody>
          </table>
        )}

        {/* Credit Records */}
        {dayCredits.length > 0 && (
          <table className="w-full border-collapse mb-3">
            <thead><tr>
              <th className={thBase}>#</th><th className={thBase}>Credit</th>
              <th className={`${thBase} text-right`}>Rate</th><th className={`${thBase} text-right`}>Litres</th>
              <th className={`${thBase} text-right`}>Inc/Exp</th>
              <th className={`${thBase} text-right`}>Amount</th>
            </tr></thead>
            <tbody>
              {dayCredits.map((c, i) => (
                <tr key={c.id || `c-${i}`}>
                  <td className={tdCenter}>{i + 1}</td>
                  <td className={tdBase}>{c.customerName}</td>
                  <td className={tdRight}>{c.rate || '-'}</td>
                  <td className={tdRight}>{c.liters ? c.liters.toFixed(2) : '-'}</td>
                  <td className={tdRight}>{formatCreditIE(c)}</td>
                  <td className={tdRight}>{c.amount.toFixed(2)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} className={`${tdBase} font-bold`}>Total</td>
                <td className={`${tdRight} font-bold`}>{stats.creditLiters.toFixed(2)}</td>
                <td className={`${tdRight} font-bold`}>
                  {(() => {
                    const net = dayCredits.reduce((a, c) => a + creditNetIncomeExpense(c), 0);
                    if (net === 0) return '0.00';
                    return `${net > 0 ? '+' : '-'}${Math.abs(net).toFixed(2)}`;
                  })()}
                </td>
                <td className={`${tdRight} font-bold`}>{stats.creditAmount.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Settlement Records */}
        {daySettlements.length > 0 && (
          <>
            <div className={`text-sm font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Settlement Records</div>
            <table className="w-full border-collapse mb-3">
              <tbody>
                {daySettlements.map((s, i) => (
                  <tr key={s.id || `st-${i}`}>
                    <td className={tdCenter}>{i + 1}</td>
                    <td className={tdBase}>{s.description || 'Settlement'}</td>
                    <td className={tdRight}>{s.amount.toFixed(2)}</td>
                  </tr>
                ))}
                <tr><td colSpan={2} className={`${tdBase} font-bold`}>Total</td><td className={`${tdRight} font-bold`}>{daySettlements.reduce((a, s) => a + s.amount, 0).toFixed(2)}</td></tr>
              </tbody>
            </table>
          </>
        )}

        {/* Income Records */}
        {dayIncome.length > 0 && (
          <>
            <div className={`text-sm font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Income Records</div>
            <table className="w-full border-collapse mb-3">
              <tbody>
                {dayIncome.map((r, i) => (
                  <tr key={r.id || `in-${i}`}>
                    <td className={tdCenter}>{i + 1}</td><td className={tdBase}>{r.description}</td><td className={tdRight}>{r.amount.toFixed(2)}</td>
                  </tr>
                ))}
                <tr><td colSpan={2} className={`${tdBase} font-bold`}>Total</td><td className={`${tdRight} font-bold`}>{dayIncome.reduce((a, v) => a + v.amount, 0).toFixed(2)}</td></tr>
              </tbody>
            </table>
          </>
        )}

        {/* Expense Records */}
        {dayExpenses.length > 0 && (
          <>
            <div className={`text-sm font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Expense Records</div>
            <table className="w-full border-collapse mb-3">
              <tbody>
                {dayExpenses.map((r, i) => (
                  <tr key={r.id || `ex-${i}`}>
                    <td className={tdCenter}>{i + 1}</td><td className={tdBase}>{r.description}</td><td className={tdRight}>{r.amount.toFixed(2)}</td>
                  </tr>
                ))}
                <tr><td colSpan={2} className={`${tdBase} font-bold`}>Total</td><td className={`${tdRight} font-bold`}>{dayExpenses.reduce((a, v) => a + v.amount, 0).toFixed(2)}</td></tr>
              </tbody>
            </table>
          </>
        )}

        {/* Receipt Records */}
        {dayReceipts.length > 0 && (
          <>
            <div className={`text-sm font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Receipt Records</div>
            <table className="w-full border-collapse mb-3">
              <tbody>
                {dayReceipts.map((p, i) => (
                  <tr key={p.id || `rc-${i}`}>
                    <td className={tdCenter}>{i + 1}</td><td className={tdBase}>{p.customerName || 'Unknown'}</td>
                    <td className={tdBase}>{p.paymentType || p.mode || '-'}</td><td className={tdRight}>{p.amount.toFixed(2)}</td>
                  </tr>
                ))}
                <tr><td colSpan={3} className={`${tdBase} font-bold`}>Total</td><td className={`${tdRight} font-bold`}>{dayReceipts.reduce((a, v) => a + v.amount, 0).toFixed(2)}</td></tr>
              </tbody>
            </table>
          </>
        )}

        {/* Bank Settlement */}
        <div className={`text-sm font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Bank Settlement Report</div>
        <table className="w-full border-collapse">
          <tbody>
            <tr><td className={tdBase}>Cash</td><td className={tdRight}>{cashT.toFixed(2)}</td></tr>
            <tr><td className={tdBase}>Card</td><td className={tdRight}>{cardT.toFixed(2)}</td></tr>
            <tr><td className={tdBase}>Paytm</td><td className={tdRight}>{paytmT.toFixed(2)}</td></tr>
            <tr><td className={tdBase}>PhonePe</td><td className={tdRight}>{phonepeT.toFixed(2)}</td></tr>
            <tr><td className={tdBase}>DTP</td><td className={tdRight}>{dtpT.toFixed(2)}</td></tr>
            <tr><td className={`${tdBase} font-bold`}>Total</td><td className={`${tdRight} font-bold`}>{bankTotal.toFixed(2)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ZAPTRStyleCalculator = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Firebase Auth and Cloud Sync states
  const [currentUser, setCurrentUser] = useState(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [showSyncPrompt, setShowSyncPrompt] = useState(false);

  const [textSize, setTextSize] = useState(100); // Default 100% (normal size)
  const [parentTab, setParentTab] = useState('today'); // Parent tab: 'today' or 'outstanding'
  const [outstandingSubTab, setOutstandingSubTab] = useState('received'); // Sub-tab in Balance view
  // Balance sub-tab order (drag-to-reorder via long-press wiggle mode)
  const [balanceTabOrder, setBalanceTabOrder] = useState(() => loadBalanceTabOrder());
  const [wiggleMode, setWiggleMode] = useState(false);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false); // Backup tab opens Settings dialog on Backup
  const [todaySubTab, setTodaySubTab] = useState('all'); // Sub-tab in Today Summary: 'all' or 'c-sales'
  const [salesData, setSalesData] = useState([]);
  const [creditData, setCreditData] = useState([]);
  const [expenseData, setExpenseData] = useState([]);
  const [incomeData, setIncomeData] = useState([]);
  const [settlementData, setSettlementData] = useState([]);
  const [fuelSettings, setFuelSettings] = useState({});
  const [selectedDate, setSelectedDate] = useState(() => {
    // Load saved operating date from localStorage, or default to today
    const saved = localStorage.getItem('mpump_operating_date');
    return saved || new Date().toISOString().split('T')[0];
  });
  const [mppTransferState, setMppTransferState] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Dialog states for edit functionality
  const [salesDialogOpen, setSalesDialogOpen] = useState(false);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [settleIncExpDialogOpen, setSettleIncExpDialogOpen] = useState(false);
  const [settleIncExpActiveTab, setSettleIncExpActiveTab] = useState('settlement');
  const [settlementDialogOpen, setSettlementDialogOpen] = useState(false);
  const [incomeExpenseDialogOpen, setIncomeExpenseDialogOpen] = useState(false);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [editingSaleData, setEditingSaleData] = useState(null);
  const [editingCreditData, setEditingCreditData] = useState(null);
  const [editingSettlementData, setEditingSettlementData] = useState(null);
  const [editingIncomeExpenseData, setEditingIncomeExpenseData] = useState(null);
  const [stockDataVersion, setStockDataVersion] = useState(0); // For triggering stock summary re-render
  
  // Notes Dialog State
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState('');
  
  // PDF Settings Dialog
  const [pdfSettingsOpen, setPdfSettingsOpen] = useState(false);
  const [pdfSettings, setPdfSettings] = useState({
    includeSales: true,
    includeCredit: true,
    includeIncome: true,
    includeExpense: true,
    includeSummary: true,
    pageSize: 'a4',
    orientation: 'portrait',
    dateRange: 'single', // 'single' or 'range'
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  
  const { toast } = useToast();

  // dnd-kit sensors for the tab reorder. Activation distance lets a normal tap
  // through; the long-press handler in SortableTab is what enters wiggle mode.
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 80, tolerance: 6 } }),
  );

  const handleBalanceTabDragEnd = (event) => {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;
    setBalanceTabOrder(prev => {
      const oldIdx = prev.indexOf(active.id);
      const newIdx = prev.indexOf(over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  // Persist + exit wiggle mode whenever the user navigates away from Balance,
  // hits the Total Summary tab, presses the Android back button, etc.
  useEffect(() => {
    if (!wiggleMode) return;
    if (parentTab !== 'outstanding') {
      setWiggleMode(false);
      saveBalanceTabOrder(balanceTabOrder);
    }
  }, [parentTab, wiggleMode, balanceTabOrder]);

  // Save final order when wiggle mode toggles off for any reason.
  useEffect(() => {
    if (!wiggleMode) saveBalanceTabOrder(balanceTabOrder);
  }, [wiggleMode, balanceTabOrder]);

  // Android hardware back: while wiggling, swallow the back press to exit
  // edit mode rather than navigate away from the app.
  useEffect(() => {
    if (!wiggleMode) return;
    const onBack = (e) => {
      e.preventDefault();
      setWiggleMode(false);
    };
    window.history.pushState({ wiggle: true }, '');
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, [wiggleMode]);

  // Auto-backup hook - automatically saves to folder when data changes
  useAutoBackup(salesData, creditData, incomeData, expenseData, fuelSettings);

  // Weekly auto-backup hook - automatically downloads backup every 7 days
  useAutoBackupWeekly(toast);

  // Load data from localStorage
  // Loading state removed per user request

  const loadData = () => {
    try {
      // Clean up any unnamespaced keys before loading
      localStorageService.cleanupUnnamedspacedKeys();
      
      // Load all data from localStorage
      const salesData = localStorageService.getSalesData();
      const creditData = localStorageService.getCreditData();
      const incomeData = localStorageService.getIncomeData();
      const expenseData = localStorageService.getExpenseData();
      const settlementData = localStorageService.getSettlements();
      const fuelSettings = localStorageService.getFuelSettings();
      const customers = localStorageService.getCustomers();
      const payments = localStorageService.getPayments();

      // Set data in component state
      setSalesData(salesData);
      setCreditData(creditData);
      setIncomeData(incomeData);
      setExpenseData(expenseData);
      setSettlementData(settlementData);
      setFuelSettings(fuelSettings);
      setCustomers(customers);
      setPayments(payments);

    } catch (err) {
      console.error('Failed to load data from localStorage:', err);
      
      // Initialize with empty data if localStorage fails
      setSalesData([]);
      setCreditData([]);
      setIncomeData([]);
      setExpenseData([]);
      setCustomers([]);
      setPayments([]);
      
      // Initialize default fuel settings
      const defaultFuelSettings = {
        'Petrol': { price: 102.50, nozzleCount: 3 },
        'Diesel': { price: 89.75, nozzleCount: 2 },
        'CNG': { price: 75.20, nozzleCount: 2 },
        'Premium': { price: 108.90, nozzleCount: 1 }
      };
      setFuelSettings(defaultFuelSettings);
      localStorageService.setFuelSettings(defaultFuelSettings);
    }
  };

  // Load data on mount (offline mode)
  useEffect(() => {
    loadData();
    // Load notes (not date-specific)
    const savedNotes = localStorage.getItem('mpp_notes');
    if (savedNotes) {
      setNotes(savedNotes);
    }

    // Listen for localStorage updates
    const handleStorageChange = () => {
      console.log('🔄 Data changed - reloading...');
      setTimeout(() => {
        loadData();
      }, 100);
    };

    window.addEventListener('localStorageChange', handleStorageChange);

    return () => {
      window.removeEventListener('localStorageChange', handleStorageChange);
    };
  }, []);

  // Reload data when date changes (to reflect any new data)
  useEffect(() => {
    loadData();
    
    // Save selected date to localStorage for persistence across refreshes
    localStorage.setItem('mpump_operating_date', selectedDate);
    
    // Reset all forms when date changes to prevent adding old data to new date
    resetAllForms();
  }, [selectedDate]);

  // Function to reset all child component forms
  const resetAllForms = () => {
    // Trigger reset in child components by updating a reset key
    setFormResetKey(prev => prev + 1);
  };

  // Add form reset state to force child component form resets
  const [formResetKey, setFormResetKey] = useState(0);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  // Text size control functions
  const increaseTextSize = () => {
    setTextSize(prevSize => {
      const newSize = Math.min(prevSize + 10, 150); // Max 150%
      localStorage.setItem('appTextSize', newSize.toString());
      document.documentElement.style.fontSize = `${newSize}%`;
      return newSize;
    });
  };

  const decreaseTextSize = () => {
    setTextSize(prevSize => {
      const newSize = Math.max(prevSize - 10, 70); // Min 70%
      localStorage.setItem('appTextSize', newSize.toString());
      document.documentElement.style.fontSize = `${newSize}%`;
      return newSize;
    });
  };

  // Load text size on component mount
  useEffect(() => {
    const savedSize = localStorage.getItem('appTextSize');
    if (savedSize) {
      const size = parseInt(savedSize);
      setTextSize(size);
      document.documentElement.style.fontSize = `${size}%`;
    }
  }, []);

  const goToPreviousDay = () => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() - 1);
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + 1);
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const formatDisplayDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getTodayStats = () => {
    const todaySales = salesData.filter(sale => sale.date === selectedDate);
    const todayCredits = creditData.filter(credit => credit.date === selectedDate);
    const todayIncome = incomeData.filter(income => income.date === selectedDate);
    const todayExpenses = expenseData.filter(expense => expense.date === selectedDate);

    // Calculate fuel sales by fuel type (excluding MPP-tagged sales). The
    // right-column "Fuel Sales" breakdown shows GROSS litres dispensed per
    // fuel type, i.e. (liters + testing). Amount stays net (money collected)
    // so it still reconciles with the Summary total.
    const fuelSalesByType = {};
    todaySales.filter(sale => !sale.mpp).forEach(sale => {
      if (!fuelSalesByType[sale.fuelType]) {
        fuelSalesByType[sale.fuelType] = { liters: 0, amount: 0 };
      }
      fuelSalesByType[sale.fuelType].liters += (parseFloat(sale.liters) || 0) + (parseFloat(sale.testing) || 0);
      fuelSalesByType[sale.fuelType].amount += sale.amount;
    });
    
    // Calculate fuel cash sales (Reading sales with type='cash' WITHOUT MPP tag)
    const fuelCashSales = todaySales
      .filter(sale => sale.type === 'cash' && !sale.mpp && sale.mpp !== true && sale.mpp !== 'true')
      .reduce((sum, sale) => sum + sale.amount, 0);
    
    // Calculate income from direct entries (separated by MPP tag)
    const directIncomeNoMPP = todayIncome.filter(income => !income.mpp).reduce((sum, income) => sum + income.amount, 0);
    const directIncomeMPP = todayIncome.filter(income => income.mpp === true || income.mpp === 'true').reduce((sum, income) => sum + income.amount, 0);
    const directIncome = directIncomeNoMPP + directIncomeMPP;
    
    // Calculate income from credit sales (separated by parent credit's MPP tag)
    const creditIncomeNoMPP = todayCredits
      .filter(credit => !credit.mpp)
      .reduce((sum, credit) => {
        if (credit.incomeEntries && credit.incomeEntries.length > 0) {
          return sum + credit.incomeEntries.reduce((incSum, entry) => incSum + entry.amount, 0);
        }
        return sum;
      }, 0);
    
    const creditIncomeMPP = todayCredits
      .filter(credit => credit.mpp === true || credit.mpp === 'true')
      .reduce((sum, credit) => {
        if (credit.incomeEntries && credit.incomeEntries.length > 0) {
          return sum + credit.incomeEntries.reduce((incSum, entry) => incSum + entry.amount, 0);
        }
        return sum;
      }, 0);
    
    const creditIncome = creditIncomeNoMPP + creditIncomeMPP;
    
    // Total income separated by MPP
    const otherIncomeNoMPP = directIncomeNoMPP + creditIncomeNoMPP;
    const otherIncomeMPP = directIncomeMPP + creditIncomeMPP;
    const otherIncome = directIncome + creditIncome;
    
    // Calculate expenses from direct entries (separated by MPP tag)
    const directExpensesNoMPP = todayExpenses.filter(expense => !expense.mpp).reduce((sum, expense) => sum + expense.amount, 0);
    const directExpensesMPP = todayExpenses.filter(expense => expense.mpp === true || expense.mpp === 'true').reduce((sum, expense) => sum + expense.amount, 0);
    const directExpenses = directExpensesNoMPP + directExpensesMPP;
    
    // Calculate expenses from credit sales (separated by parent credit's MPP tag)
    const creditExpensesNoMPP = todayCredits
      .filter(credit => !credit.mpp)
      .reduce((sum, credit) => {
        if (credit.expenseEntries && credit.expenseEntries.length > 0) {
          return sum + credit.expenseEntries.reduce((expSum, entry) => expSum + entry.amount, 0);
        }
        return sum;
      }, 0);
    
    const creditExpensesMPP = todayCredits
      .filter(credit => credit.mpp === true || credit.mpp === 'true')
      .reduce((sum, credit) => {
        if (credit.expenseEntries && credit.expenseEntries.length > 0) {
          return sum + credit.expenseEntries.reduce((expSum, entry) => expSum + entry.amount, 0);
        }
        return sum;
      }, 0);
    
    const creditExpenses = creditExpensesNoMPP + creditExpensesMPP;
    
    // Total expenses separated by MPP
    const totalExpensesNoMPP = directExpensesNoMPP + creditExpensesNoMPP;
    const totalExpensesMPP = directExpensesMPP + creditExpensesMPP;
    const totalExpenses = directExpenses + creditExpenses;
    
    // Calculate credit amount and liters (separated by MPP tag)
    const creditNoMPP = todayCredits.filter(c => !c.mpp && c.mpp !== true && c.mpp !== 'true');
    const creditWithMPP = todayCredits.filter(c => c.mpp === true || c.mpp === 'true');
    
    const creditTotalAmountNoMPP = creditNoMPP.reduce((sum, credit) => sum + credit.amount, 0);
    const creditTotalAmount = todayCredits.reduce((sum, credit) => sum + credit.amount, 0);
    
    const creditLitersNoMPP = creditNoMPP.reduce((sum, credit) => {
      if (credit.fuelEntries && credit.fuelEntries.length > 0) {
        return sum + credit.fuelEntries.reduce((literSum, entry) => literSum + entry.liters, 0);
      } else if (credit.liters) {
        return sum + credit.liters;
      }
      return sum;
    }, 0);
    
    const creditLiters = todayCredits.reduce((sum, credit) => {
      if (credit.fuelEntries && credit.fuelEntries.length > 0) {
        return sum + credit.fuelEntries.reduce((literSum, entry) => literSum + entry.liters, 0);
      } else if (credit.liters) {
        return sum + credit.liters;
      }
      return sum;
    }, 0);
    
    const creditLitersMPP = creditWithMPP.reduce((sum, credit) => {
      if (credit.fuelEntries && credit.fuelEntries.length > 0) {
        return sum + credit.fuelEntries.reduce((literSum, entry) => literSum + entry.liters, 0);
      } else if (credit.liters) {
        return sum + credit.liters;
      }
      return sum;
    }, 0);
    
    const creditAmountMPP = creditWithMPP.reduce((sum, credit) => sum + credit.amount, 0);
    
    // Calculate settlements without MPP tag
    const todaySettlements = settlementData.filter(s => s.date === selectedDate);
    const settlementNoMPP = todaySettlements.filter(s => !s.mpp).reduce((sum, s) => sum + (s.amount || 0), 0);
    
    const salesWithMPP = todaySales.filter(s => s.mpp === true || s.mpp === 'true');
    
    const fuelSalesMPP = salesWithMPP.reduce((sum, sale) => sum + sale.amount, 0);
    const fuelLitersMPP = salesWithMPP.reduce((sum, sale) => sum + sale.liters, 0);
    
    const settlementMPP = todaySettlements.filter(s => s.mpp === true || s.mpp === 'true').reduce((sum, s) => sum + (s.amount || 0), 0);
    const mppCash = fuelSalesMPP - creditAmountMPP - totalExpensesMPP + otherIncomeMPP - settlementMPP;
    const hasMPPData = fuelSalesMPP > 0 || creditAmountMPP > 0 || settlementMPP > 0 || otherIncomeMPP > 0 || totalExpensesMPP > 0;
    
    // Fuel sales without MPP (for left column)
    const salesNoMPP = todaySales.filter(sale => sale.type === 'cash' && !sale.mpp && sale.mpp !== true && sale.mpp !== 'true');
    
    const fuelSalesNoMPP = fuelCashSales;
    const fuelLitersNoMPP = salesNoMPP.reduce((sum, sale) => sum + sale.liters, 0);
    
    // Total fuel amount and liters (all sales including MPP)
    const totalLiters = todaySales.reduce((sum, sale) => sum + sale.liters, 0);
    const totalFuelAmount = todaySales.filter(sale => sale.type === 'cash' || !sale.type).reduce((sum, sale) => sum + sale.amount, 0);

    // Cash receipts (payments with paymentType 'Cash') for today
    const todayPayments = payments.filter(p => p.date === selectedDate);
    const cashReceipts = todayPayments
      .filter(p => (p.paymentType || p.mode || '').toLowerCase() === 'cash')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    // Cash in Hand = All Fuel Sales - All Credit Sales + All Income - All Expenses - All Settlement + Cash Receipts
    const totalSettlement = todaySettlements.reduce((sum, s) => sum + (s.amount || 0), 0);
    const cashInHand = totalFuelAmount - creditTotalAmount + otherIncome - totalExpenses - totalSettlement + cashReceipts;
    
    // MPP Cash is separate and calculated independently
    // Total available cash = Cash in Hand + MPP Cash (for display only)
    const totalAvailableCash = cashInHand + mppCash;
    
    // Total income is fuel sales + other income
    const totalIncome = fuelCashSales + otherIncome;
    
    // Net cash position (what's actually in hand - no MPP)
    const netCash = cashInHand;
    
    return { 
      fuelCashSales,
      cashInHand,
      mppCash,
      totalAvailableCash,
      hasMPPData,
      creditAmount: creditTotalAmount,
      creditLiters,
      totalLiters,
      totalFuelAmount,
      totalSales: fuelCashSales + creditTotalAmount,
      otherIncome,
      otherIncomeNoMPP,
      otherIncomeMPP,
      totalIncome,
      totalExpenses,
      totalExpensesNoMPP,
      totalExpensesMPP,
      netCash,
      fuelSalesByType,
      // Separate MPP data
      fuelSalesNoMPP,
      fuelLitersNoMPP,
      creditAmountNoMPP: creditTotalAmountNoMPP,
      creditLitersNoMPP,
      settlementNoMPP,
      totalSettlement,
      fuelSalesMPP,
      fuelLitersMPP,
      creditAmountMPP,
      creditLitersMPP,
      settlementMPP
    };
  };

  // Recalculate stats when data or sync changes
  const stats = React.useMemo(() => {
    return getTodayStats();
  }, [salesData, creditData, incomeData, expenseData, settlementData, selectedDate, payments]);

  // Data handling functions (offline localStorage)
  const addSaleRecord = (saleData) => {
    try {
      console.log('=== ADDING SALE RECORD ===');
      console.log('Sale Data:', {
        ...saleData,
        date: selectedDate,
        mpp: saleData.mpp,
        mppType: typeof saleData.mpp
      });
      
      const newSale = localStorageService.addSaleRecord({
        ...saleData,
        date: selectedDate
      });
      
      console.log('Sale Added to Storage:', newSale);
      console.log('MPP field saved:', newSale.mpp, 'Type:', typeof newSale.mpp);
      
      // Update local state immediately
      setSalesData(prev => {
        const updated = [...prev, newSale];
        console.log('Updated salesData state:', updated.map(s => ({ id: s.id, mpp: s.mpp, amount: s.amount })));
        return updated;
      });
      
      return newSale;
    } catch (error) {
      console.error('Failed to add sale record:', error);
    }
  };

  const addCreditRecord = (creditData) => {
    try {
      const newCredit = localStorageService.addCreditRecord({
        ...creditData,
        // Use the date from creditData if provided, otherwise use selectedDate
        date: creditData.date || selectedDate
      });
      
      // Update local state immediately
      setCreditData(prev => [...prev, newCredit]);
      
      // Auto-create payment for MPP if this is MPP-tagged credit to another customer
      if ((newCredit.mpp === true || newCredit.mpp === 'true') && !newCredit.customerName?.toLowerCase().includes('manager petrol pump')) {
        const mppCustomer = customers.find(c => c.isMPP === true || c.name.toLowerCase().includes('manager petrol pump'));
        
        if (mppCustomer) {
          // Calculate ONLY fuel amount (excluding income and expenses)
          let fuelAmount = 0;
          if (newCredit.fuelEntries && newCredit.fuelEntries.length > 0) {
            fuelAmount = newCredit.fuelEntries.reduce((sum, entry) => {
              return sum + (parseFloat(entry.liters || 0) * parseFloat(entry.rate || 0));
            }, 0);
          } else {
            // Fallback to total amount if no fuelEntries (shouldn't happen, but safe)
            fuelAmount = newCredit.amount;
          }
          
          const autoPayment = {
            customerId: mppCustomer.id,
            customerName: mppCustomer.name,
            amount: fuelAmount,
            date: newCredit.date,
            mode: 'auto',
            linkedMPPCreditId: newCredit.id,
            isAutoMPPTracking: true,
            description: `MPP Credit Sale to ${newCredit.customerName}`
          };
          
          const createdPayment = localStorageService.addPayment(autoPayment);
          setPayments(localStorageService.getPayments());
          
          console.log('Auto-created MPP payment for credit sale (fuel only):', createdPayment);
        }
      }
      
      return newCredit;
    } catch (error) {
      console.error('Failed to add credit record:', error);
    }
  };

  const addIncomeRecord = (incomeData) => {
    try {
      const newIncome = localStorageService.addIncomeRecord({
        ...incomeData,
        date: selectedDate
      });
      
      // Update local state immediately
      setIncomeData(prev => [...prev, newIncome]);
      
      return newIncome;
    } catch (error) {
      console.error('Failed to add income record:', error);
    }
  };

  const addExpenseRecord = (expenseData) => {
    try {
      const newExpense = localStorageService.addExpenseRecord({
        ...expenseData,
        date: selectedDate
      });
      
      // Update local state immediately
      setExpenseData(prev => [...prev, newExpense]);
      
      return newExpense;
    } catch (error) {
      console.error('Failed to add expense record:', error);
    }
  };

  const addSettlementRecord = (settlementData) => {
    try {
      const newSettlement = localStorageService.addSettlement({
        ...settlementData,
        date: selectedDate
      });
      
      // Update local state immediately
      setSettlementData(prev => [...prev, newSettlement]);
      
      // Auto-create payment for MPP if this is MPP-tagged settlement
      if (newSettlement.mpp === true || newSettlement.mpp === 'true') {
        const mppCustomer = customers.find(c => c.isMPP === true || c.name.toLowerCase().includes('manager petrol pump'));
        
        if (mppCustomer) {
          const autoPayment = {
            customerId: mppCustomer.id,
            customerName: mppCustomer.name,
            amount: newSettlement.amount,
            date: newSettlement.date,
            mode: 'auto',
            linkedMPPSettlementId: newSettlement.id,
            isAutoMPPTracking: true,
            description: `MPP Settlement - ${newSettlement.description || 'Settlement'}`
          };
          
          const createdPayment = localStorageService.addPayment(autoPayment);
          setPayments(localStorageService.getPayments());
          
          console.log('Auto-created MPP payment for settlement:', createdPayment);
        }
      }
      
      return newSettlement;
    } catch (error) {
      console.error('Failed to add settlement record:', error);
    }
  };

  // Delete functions
  const deleteSaleRecord = (id) => {
    try {
      const success = localStorageService.deleteSaleRecord(id);
      if (success) {
        setSalesData(prev => prev.filter(sale => sale.id !== id));
        return true;
      }
    } catch (error) {
      console.error('Failed to delete sale record:', error);
    }
    return false;
  };

  const deleteCreditRecord = (id) => {
    try {
      // Find and delete linked MPP payment if exists
      const linkedPayment = payments.find(p => p.linkedMPPCreditId === id && p.isAutoMPPTracking === true);
      if (linkedPayment) {
        localStorageService.deletePayment(linkedPayment.id);
        console.log('Deleted linked MPP payment:', linkedPayment.id);
      }
      
      const success = localStorageService.deleteCreditRecord(id);
      if (success) {
        setCreditData(prev => prev.filter(credit => credit.id !== id));
        if (linkedPayment) {
          setPayments(localStorageService.getPayments());
        }
        return true;
      }
    } catch (error) {
      console.error('Error deleting credit record:', error);
    }
    return false;
  };

  const deleteIncomeRecord = (id) => {
    try {
      const success = localStorageService.deleteIncomeRecord(id);
      if (success) {
        setIncomeData(prev => prev.filter(income => income.id !== id));
        return true;
      }
    } catch (error) {
      console.error('Failed to delete income record:', error);
    }
    return false;
  };

  const deleteExpenseRecord = (id) => {
    try {
      const success = localStorageService.deleteExpenseRecord(id);
      if (success) {
        setExpenseData(prev => prev.filter(expense => expense.id !== id));
        return true;
      }
    } catch (error) {
      console.error('Failed to delete expense record:', error);
    }
    return false;
  };

  const deleteSettlementRecord = (id) => {
    try {
      // Find and delete linked MPP payment if exists
      const linkedPayment = payments.find(p => p.linkedMPPSettlementId === id && p.isAutoMPPTracking === true);
      if (linkedPayment) {
        localStorageService.deletePayment(linkedPayment.id);
        console.log('Deleted linked MPP payment for settlement:', linkedPayment.id);
      }
      
      const success = localStorageService.deleteSettlement(id);
      if (success) {
        setSettlementData(prev => prev.filter(settlement => settlement.id !== id));
        if (linkedPayment) {
          setPayments(localStorageService.getPayments());
        }
        return true;
      }
    } catch (error) {
      console.error('Error deleting settlement record:', error);
    }
    return false;
  };

  // Edit dialog handlers
  // Balance tab navigation state (for mobile blocks)
  const [showBalanceBlocks, setShowBalanceBlocks] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [savedScrollPosition, setSavedScrollPosition] = useState(0);

  // Global Android back-button handler — keeps the user inside the app and
  // walks the navigation hierarchy: wiggle → open dialogs → balance subpage →
  // balance grid → today summary (home). Pressing back on home does NOTHING
  // (the user must use Home button / swipe-up to leave the app).
  const backStateRef = useRef({});
  backStateRef.current = {
    wiggleMode, setWiggleMode,
    pdfSettingsOpen, setPdfSettingsOpen,
    backupDialogOpen, setBackupDialogOpen,
    salesDialogOpen, setSalesDialogOpen,
    creditDialogOpen, setCreditDialogOpen,
    settleIncExpDialogOpen, setSettleIncExpDialogOpen,
    settlementDialogOpen, setSettlementDialogOpen,
    incomeExpenseDialogOpen, setIncomeExpenseDialogOpen,
    stockDialogOpen, setStockDialogOpen,
    rateDialogOpen, setRateDialogOpen,
    parentTab, setParentTab,
    showBalanceBlocks, setShowBalanceBlocks,
  };

  useEffect(() => {
    window.MPumpAppHandleBack = () => {
      // 1) Let any open dialog (HeaderSettings, Record Receipt sheet, etc.)
      //    handle the back press first via the 'mpump-back' event.
      try {
        const evt = new CustomEvent('mpump-back', { cancelable: true });
        window.dispatchEvent(evt);
        if (evt.defaultPrevented) return true;
      } catch (err) { console.warn('mpump-back dispatch failed:', err); }

      const s = backStateRef.current;

      // 2) Wiggle (drag-reorder) mode
      if (s.wiggleMode) { s.setWiggleMode(false); return true; }

      // 3) Modal sheets owned by the main calculator screen
      if (s.pdfSettingsOpen)        { s.setPdfSettingsOpen(false); return true; }
      if (s.backupDialogOpen)       { s.setBackupDialogOpen(false); return true; }
      if (s.stockDialogOpen)        { s.setStockDialogOpen(false); return true; }
      if (s.rateDialogOpen)         { s.setRateDialogOpen(false); return true; }
      if (s.salesDialogOpen)        { s.setSalesDialogOpen(false); return true; }
      if (s.creditDialogOpen)       { s.setCreditDialogOpen(false); return true; }
      if (s.settleIncExpDialogOpen) { s.setSettleIncExpDialogOpen(false); return true; }
      if (s.settlementDialogOpen)   { s.setSettlementDialogOpen(false); return true; }
      if (s.incomeExpenseDialogOpen){ s.setIncomeExpenseDialogOpen(false); return true; }

      // 4) Balance sub-page → Balance grid
      if (s.parentTab === 'outstanding' && !s.showBalanceBlocks) {
        s.setShowBalanceBlocks(true);
        return true;
      }

      // 5) Balance grid → Today Summary (home)
      if (s.parentTab === 'outstanding') {
        s.setParentTab('today');
        return true;
      }

      // 6) Already at home — never exit the app
      return false;
    };
    return () => { try { delete window.MPumpAppHandleBack; } catch (err) { console.warn('back-handler cleanup failed:', err); } };
  }, []);
  
  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    try {
      setSyncBusy(true);
      await syncService.signIn();
      toast({
        title: "Signed In Successfully",
        description: "Welcome to M.Petrol Pump cloud dashboard!",
        variant: "success",
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Sign In Failed",
        description: "Could not log in with Google. Please retry.",
        variant: "destructive",
      });
    } finally {
      setSyncBusy(false);
    }
  };

  // Handle Google Account Sign-Out
  const handleGoogleSignOut = async () => {
    try {
      setSyncBusy(true);
      await syncService.logout();
      toast({
        title: "Signed Out",
        description: "Using offline local storage on this device.",
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Sign Out Failed",
        description: "Could not sign out completely.",
        variant: "destructive",
      });
    } finally {
      setSyncBusy(false);
    }
  };

  // Handle local data merge with user's Google cloud account
  const handleMergeGuestData = async () => {
    try {
      setSyncBusy(true);
      if (!auth.currentUser) return;
      const userUid = auth.currentUser.uid;

      // Switch back to offline namespace to retrieve guest-only data
      localStorageService.setNamespace('local');
      const guestData = {
        salesData: localStorageService.getSalesData(),
        creditData: localStorageService.getCreditData(),
        incomeData: localStorageService.getIncomeData(),
        expenseData: localStorageService.getExpenseData(),
        payments: localStorageService.getPayments(),
        settlements: localStorageService.getSettlements(),
        customers: localStorageService.getCustomers(),
        settlementTypes: localStorageService.getSettlementTypes(),
        incomeCategories: localStorageService.getIncomeCategories(),
        expenseCategories: localStorageService.getExpenseCategories(),
        fuelSettings: localStorageService.getFuelSettings(),
        rates: localStorageService.getAllRates()
      };

      // Switch back to authed user namespace and merge data
      localStorageService.setNamespace(userUid);
      localStorageService.mergeAllData(guestData);

      // Save/Push to Cloud Firestore
      await syncService.pushToCloud();

      // Clear guest/offline namespace to avoid repeat merging requests
      localStorageService.setNamespace('local');
      localStorageService.setSalesData([]);
      localStorageService.setCreditData([]);
      localStorageService.setIncomeData([]);
      localStorageService.setExpenseData([]);
      localStorageService.setPayments([]);
      localStorageService.setSettlements([]);
      
      // Finally return namespace to active user Uid
      localStorageService.setNamespace(userUid);

      toast({
        title: "Data Synced",
        description: "Your local records are now secured on Google cloud!",
        variant: "success",
      });
    } catch (e) {
      console.error("Local merge failed:", e);
      toast({
        title: "Sync Merge Failed",
        description: "Failed to upload local records to Google cloud database.",
        variant: "destructive",
      });
    } finally {
      setSyncBusy(false);
      setShowSyncPrompt(false);
      loadData();
    }
  };

  // Skip merging guest data, load cloud data as is
  const handleDiscardMerge = async () => {
    try {
      setSyncBusy(true);
      if (auth.currentUser) {
        localStorageService.setNamespace(auth.currentUser.uid);
        await syncService.pullFromCloud();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSyncBusy(false);
      setShowSyncPrompt(false);
      loadData();
    }
  };

  const handleManualSync = async () => {
    try {
      setSyncBusy(true);
      await syncService.pullFromCloud();
      toast({
        title: "Synced with Cloud",
        description: "Your records are up to date.",
        variant: "success"
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Sync Failed",
        description: "Check internet connection and retry.",
        variant: "destructive"
      });
    } finally {
      setSyncBusy(false);
      loadData();
    }
  };

  // Monitor Authentication and Sync status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Grab records from guest namespace to check if migration/import is needed
        localStorageService.setNamespace('local');
        const offlineSales = localStorageService.getSalesData();
        const offlineCredits = localStorageService.getCreditData();
        const hasOfflineRecords = (offlineSales && offlineSales.length > 0) || (offlineCredits && offlineCredits.length > 0);
        
        // Switch to authenticated namespace
        localStorageService.setNamespace(user.uid);

        if (hasOfflineRecords) {
          try {
            setSyncBusy(true);
            const cloudSales = await syncService.getCollectionFromCloud('sales');
            const cloudCredits = await syncService.getCollectionFromCloud('credits');

            if (cloudSales.length === 0 && cloudCredits.length === 0) {
              setShowSyncPrompt(true);
            } else {
              // Pull cloud records directly
              await syncService.pullFromCloud();
            }
          } catch (e) {
            console.error('Error determining cloud setup:', e);
            await syncService.pullFromCloud();
          } finally {
            setSyncBusy(false);
          }
        } else {
          setSyncBusy(true);
          await syncService.pullFromCloud();
          setSyncBusy(false);
        }
      } else {
        setCurrentUser(null);
        localStorageService.setNamespace('local');
      }
      loadData();
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Handle Balance tab click - toggle between blocks and content
  const handleBalanceTabClick = () => {
    if (parentTab === 'outstanding' && !showBalanceBlocks) {
      // If we're already in Balance tab and showing content, go back to blocks
      setShowBalanceBlocks(true);
    } else {
      // Normal tab switch to Balance
      setParentTab('outstanding');
      setShowBalanceBlocks(true);
    }
  };

  // Handle block click - show content and hide blocks
  const handleBalanceBlockClick = (blockType) => {
    if (blockType === 'backup') {
      setBackupDialogOpen(true);
      return;
    }
    setOutstandingSubTab(blockType);
    setShowBalanceBlocks(false);
  };

  // Save scroll position before opening dialogs
  const saveScrollPosition = () => {
    setSavedScrollPosition(window.pageYOffset || document.documentElement.scrollTop);
  };

  // Restore scroll position after dialog closes
  const restoreScrollPosition = () => {
    setTimeout(() => {
      window.scrollTo({
        top: savedScrollPosition,
        behavior: 'smooth'
      });
    }, 100);
  };

  const handleEditSale = (saleRecord) => {
    saveScrollPosition();
    setEditingSaleData(saleRecord);
    setSalesDialogOpen(true);
  };

  const handleEditCredit = (creditRecord) => {
    saveScrollPosition();
    setEditingCreditData(creditRecord);
    setCreditDialogOpen(true);
  };

  const handleEditIncomeExpense = (record, type) => {
    saveScrollPosition();
    setEditingIncomeExpenseData({ ...record, type });
    setIncomeExpenseDialogOpen(true);
  };

  const handleEditSettlement = (settlementRecord) => {
    console.log('handleEditSettlement called with:', settlementRecord);
    saveScrollPosition();
    setEditingSettlementData(settlementRecord);
    setSettlementDialogOpen(true);
  };

  const handleCloseDialogs = () => {
    setSalesDialogOpen(false);
    setCreditDialogOpen(false);
    setSettleIncExpDialogOpen(false);
    setSettlementDialogOpen(false);
    setIncomeExpenseDialogOpen(false);
    setEditingSaleData(null);
    setEditingCreditData(null);
    setEditingSettlementData(null);
    setEditingIncomeExpenseData(null);
    
    // Restore scroll position after dialog closes
    restoreScrollPosition();
  };

  // Update functions
  const updateSaleRecord = (id, updatedData) => {
    try {
      const updatedSale = localStorageService.updateSaleRecord(id, updatedData);
      if (updatedSale) {
        setSalesData(prev => prev.map(sale => sale.id === id ? updatedSale : sale));
        return updatedSale;
      }
    } catch (error) {
      console.error('Failed to update sale record:', error);
    }
    return null;
  };

  const updateCreditRecord = (id, updatedData) => {
    try {
      const updatedCredit = localStorageService.updateCreditRecord(id, updatedData);
      if (updatedCredit) {
        setCreditData(prev => prev.map(credit => credit.id === id ? updatedCredit : credit));
        
        // Update linked MPP payment if exists
        const linkedPayment = payments.find(p => p.linkedMPPCreditId === id && p.isAutoMPPTracking === true);
        if (linkedPayment) {
          // Calculate ONLY fuel amount (excluding income and expenses)
          let fuelAmount = 0;
          if (updatedCredit.fuelEntries && updatedCredit.fuelEntries.length > 0) {
            fuelAmount = updatedCredit.fuelEntries.reduce((sum, entry) => {
              return sum + (parseFloat(entry.liters || 0) * parseFloat(entry.rate || 0));
            }, 0);
          } else {
            fuelAmount = updatedCredit.amount;
          }
          
          // Update the linked payment with new fuel amount
          localStorageService.updatePayment(linkedPayment.id, {
            ...linkedPayment,
            amount: fuelAmount,
            date: updatedCredit.date,
            description: `MPP Credit Sale to ${updatedCredit.customerName}`
          });
          setPayments(localStorageService.getPayments());
          console.log('Updated linked MPP payment (fuel only):', linkedPayment.id);
        } else if ((updatedCredit.mpp === true || updatedCredit.mpp === 'true') && !updatedCredit.customerName?.toLowerCase().includes('manager petrol pump')) {
          // If credit was just tagged as MPP, create new auto-payment
          const mppCustomer = customers.find(c => c.isMPP === true || c.name.toLowerCase().includes('manager petrol pump'));
          
          if (mppCustomer) {
            // Calculate ONLY fuel amount (excluding income and expenses)
            let fuelAmount = 0;
            if (updatedCredit.fuelEntries && updatedCredit.fuelEntries.length > 0) {
              fuelAmount = updatedCredit.fuelEntries.reduce((sum, entry) => {
                return sum + (parseFloat(entry.liters || 0) * parseFloat(entry.rate || 0));
              }, 0);
            } else {
              fuelAmount = updatedCredit.amount;
            }
            
            const autoPayment = {
              customerId: mppCustomer.id,
              customerName: mppCustomer.name,
              amount: fuelAmount,
              date: updatedCredit.date,
              mode: 'auto',
              linkedMPPCreditId: updatedCredit.id,
              isAutoMPPTracking: true,
              description: `MPP Credit Sale to ${updatedCredit.customerName}`
            };
            
            localStorageService.addPayment(autoPayment);
            setPayments(localStorageService.getPayments());
            console.log('Created new MPP payment for updated credit (fuel only):', autoPayment);
          }
        }
        
        return updatedCredit;
      }
    } catch (error) {
      console.error('Failed to update credit record:', error);
    }
    return null;
  };

  const updateIncomeRecord = (id, updatedData) => {
    try {
      const updatedIncome = localStorageService.updateIncomeRecord(id, updatedData);
      if (updatedIncome) {
        setIncomeData(prev => prev.map(income => income.id === id ? updatedIncome : income));
        return updatedIncome;
      }
    } catch (error) {
      console.error('Failed to update income record:', error);
    }
    return null;
  };

  const updateExpenseRecord = (id, updatedData) => {
    try {
      const updatedExpense = localStorageService.updateExpenseRecord(id, updatedData);
      if (updatedExpense) {
        setExpenseData(prev => prev.map(expense => expense.id === id ? updatedExpense : expense));
        return updatedExpense;
      }
    } catch (error) {
      console.error('Failed to update expense record:', error);
    }
    return null;
  };

  const updateSettlementRecord = (id, updatedData) => {
    try {
      const updatedSettlement = localStorageService.updateSettlement(id, updatedData);
      if (updatedSettlement) {
        setSettlementData(prev => prev.map(settlement => settlement.id === id ? updatedSettlement : settlement));
        
        // Update linked MPP payment if exists
        const linkedPayment = payments.find(p => p.linkedMPPSettlementId === id && p.isAutoMPPTracking === true);
        if (linkedPayment) {
          // Update the linked payment with new amount
          localStorageService.updatePayment(linkedPayment.id, {
            ...linkedPayment,
            amount: updatedSettlement.amount,
            date: updatedSettlement.date,
            description: `MPP Settlement - ${updatedSettlement.description || 'Settlement'}`
          });
          setPayments(localStorageService.getPayments());
          console.log('Updated linked MPP payment for settlement:', linkedPayment.id);
        } else if (updatedSettlement.mpp === true || updatedSettlement.mpp === 'true') {
          // If settlement was just tagged as MPP, create new auto-payment
          const mppCustomer = customers.find(c => c.isMPP === true || c.name.toLowerCase().includes('manager petrol pump'));
          
          if (mppCustomer) {
            const autoPayment = {
              customerId: mppCustomer.id,
              customerName: mppCustomer.name,
              amount: updatedSettlement.amount,
              date: updatedSettlement.date,
              mode: 'auto',
              linkedMPPSettlementId: updatedSettlement.id,
              isAutoMPPTracking: true,
              description: `MPP Settlement - ${updatedSettlement.description || 'Settlement'}`
            };
            
            localStorageService.addPayment(autoPayment);
            setPayments(localStorageService.getPayments());
            console.log('Created new MPP payment for updated settlement:', autoPayment);
          }
        }
        
        return updatedSettlement;
      }
    } catch (error) {
      console.error('Error updating settlement record:', error);
    }
    return null;
  };

  const updateFuelRate = (fuelType, rate, date = selectedDate) => {
    try {
      // Save rate for the specific date
      const success = localStorageService.updateFuelRate(fuelType, rate, date);
      
      if (success) {
        // Update local state immediately
        setFuelSettings(prev => ({
          ...prev,
          [fuelType]: { ...prev[fuelType], price: parseFloat(rate) }
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating fuel rate:', error);
      return false;
    }
  };

  // Customer Management Handlers
  const handleAddCustomer = (name, startingBalance = 0, isMPP = false) => {
    try {
      const newCustomer = localStorageService.addCustomer(name, startingBalance, isMPP);
      setCustomers(localStorageService.getCustomers()); // Reload sorted list
      toast({
        title: "Success",
        description: `Customer "${name}" added successfully.`,
        variant: "default"
      });
      return newCustomer;
    } catch (error) {
      console.error('Error adding customer:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to add customer.',
        variant: "destructive"
      });
      return null;
    }
  };

  const handleDeleteCustomer = (id) => {
    try {
      localStorageService.deleteCustomer(id);
      setCustomers(localStorageService.getCustomers());
    } catch (error) {
      console.error('Error deleting customer:', error);
    }
  };

  const handleUpdateCustomer = (id, startingBalance, isMPP) => {
    try {
      localStorageService.updateCustomer(id, startingBalance, isMPP);
      setCustomers(localStorageService.getCustomers());
      toast({
        title: "Success",
        description: "Customer updated successfully.",
        variant: "default"
      });
    } catch (error) {
      console.error('Error updating customer:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to update customer.',
        variant: "destructive"
      });
    }
  };

  // Payment Handlers
  const handleAddPayment = (paymentData) => {
    try {
      localStorageService.addPayment(paymentData);
      setPayments(localStorageService.getPayments());
    } catch (error) {
      console.error('Error adding payment:', error);
    }
  };

  const handleUpdatePayment = (id, paymentData) => {
    try {
      localStorageService.updatePayment(id, paymentData);
      setPayments(localStorageService.getPayments());
    } catch (error) {
      console.error('Error updating payment:', error);
    }
  };

  const handleDeletePayment = (id) => {
    try {
      localStorageService.deletePayment(id);
      setPayments(localStorageService.getPayments());
    } catch (error) {
      console.error('Error deleting payment:', error);
    }
  };

  // Export functions
  
  // Helper function to calculate stats for any data set
  const calculateStatsWithMPP = (sales, credits, income, expenses, settlements) => {
    // Separate sales by MPP tag
    const salesNoMPP = sales.filter(s => !s.mpp && s.mpp !== true && s.mpp !== 'true');
    const salesMPP = sales.filter(s => s.mpp === true || s.mpp === 'true');
    
    // Calculate fuel sales by type (separated by MPP)
    const fuelSalesByTypeNoMPP = {};
    const fuelSalesByTypeMPP = {};
    
    salesNoMPP.forEach(sale => {
      if (!fuelSalesByTypeNoMPP[sale.fuelType]) {
        fuelSalesByTypeNoMPP[sale.fuelType] = { liters: 0, amount: 0 };
      }
      fuelSalesByTypeNoMPP[sale.fuelType].liters += sale.liters;
      fuelSalesByTypeNoMPP[sale.fuelType].amount += sale.amount;
    });
    
    salesMPP.forEach(sale => {
      if (!fuelSalesByTypeMPP[sale.fuelType]) {
        fuelSalesByTypeMPP[sale.fuelType] = { liters: 0, amount: 0 };
      }
      fuelSalesByTypeMPP[sale.fuelType].liters += sale.liters;
      fuelSalesByTypeMPP[sale.fuelType].amount += sale.amount;
    });
    
    const fuelSalesNoMPP = salesNoMPP.reduce((sum, s) => sum + s.amount, 0);
    const fuelLitersNoMPP = salesNoMPP.reduce((sum, s) => sum + s.liters, 0);
    const fuelSalesMPP = salesMPP.reduce((sum, s) => sum + s.amount, 0);
    const fuelLitersMPP = salesMPP.reduce((sum, s) => sum + s.liters, 0);

    // Separate credits by MPP tag
    const creditsNoMPP = credits.filter(c => !c.mpp && c.mpp !== true && c.mpp !== 'true');
    const creditsMPP = credits.filter(c => c.mpp === true || c.mpp === 'true');
    
    const creditTotalAmountNoMPP = creditsNoMPP.reduce((sum, c) => sum + c.amount, 0);
    const creditAmountMPP = creditsMPP.reduce((sum, c) => sum + c.amount, 0);
    
    const creditLitersNoMPP = creditsNoMPP.reduce((sum, credit) => {
      if (credit.fuelEntries && credit.fuelEntries.length > 0) {
        return sum + credit.fuelEntries.reduce((literSum, entry) => literSum + entry.liters, 0);
      } else if (credit.liters) {
        return sum + credit.liters;
      }
      return sum;
    }, 0);
    
    const creditLitersMPP = creditsMPP.reduce((sum, credit) => {
      if (credit.fuelEntries && credit.fuelEntries.length > 0) {
        return sum + credit.fuelEntries.reduce((literSum, entry) => literSum + entry.liters, 0);
      } else if (credit.liters) {
        return sum + credit.liters;
      }
      return sum;
    }, 0);
    
    // Separate income by MPP tag
    const directIncomeNoMPP = income.filter(i => !i.mpp).reduce((sum, i) => sum + i.amount, 0);
    const directIncomeMPP = income.filter(i => i.mpp === true || i.mpp === 'true').reduce((sum, i) => sum + i.amount, 0);
    
    const creditIncomeNoMPP = creditsNoMPP.reduce((sum, credit) => {
      if (credit.incomeEntries && credit.incomeEntries.length > 0) {
        return sum + credit.incomeEntries.reduce((incSum, entry) => incSum + entry.amount, 0);
      }
      return sum;
    }, 0);
    
    const creditIncomeMPP = creditsMPP.reduce((sum, credit) => {
      if (credit.incomeEntries && credit.incomeEntries.length > 0) {
        return sum + credit.incomeEntries.reduce((incSum, entry) => incSum + entry.amount, 0);
      }
      return sum;
    }, 0);
    
    const otherIncomeNoMPP = directIncomeNoMPP + creditIncomeNoMPP;
    const otherIncomeMPP = directIncomeMPP + creditIncomeMPP;
    
    // Separate expenses by MPP tag
    const directExpensesNoMPP = expenses.filter(e => !e.mpp).reduce((sum, e) => sum + e.amount, 0);
    const directExpensesMPP = expenses.filter(e => e.mpp === true || e.mpp === 'true').reduce((sum, e) => sum + e.amount, 0);
    
    const creditExpensesNoMPP = creditsNoMPP.reduce((sum, credit) => {
      if (credit.expenseEntries && credit.expenseEntries.length > 0) {
        return sum + credit.expenseEntries.reduce((expSum, entry) => expSum + entry.amount, 0);
      }
      return sum;
    }, 0);
    
    const creditExpensesMPP = creditsMPP.reduce((sum, credit) => {
      if (credit.expenseEntries && credit.expenseEntries.length > 0) {
        return sum + credit.expenseEntries.reduce((expSum, entry) => expSum + entry.amount, 0);
      }
      return sum;
    }, 0);
    
    const totalExpensesNoMPP = directExpensesNoMPP + creditExpensesNoMPP;
    const totalExpensesMPP = directExpensesMPP + creditExpensesMPP;
    
    // Separate settlements by MPP tag
    const settlementNoMPP = settlements.filter(s => !s.mpp).reduce((sum, s) => sum + (s.amount || 0), 0);
    const settlementMPP = settlements.filter(s => s.mpp === true || s.mpp === 'true').reduce((sum, s) => sum + (s.amount || 0), 0);
    
    // Calculate Cash in Hand and MPP Cash
    const cashInHand = fuelSalesNoMPP - creditTotalAmountNoMPP - totalExpensesNoMPP + otherIncomeNoMPP - settlementNoMPP;
    const mppCash = fuelSalesMPP - creditAmountMPP - totalExpensesMPP + otherIncomeMPP - settlementMPP;
    
    // Check if there's any MPP data
    const hasMPPData = fuelSalesMPP > 0 || creditAmountMPP > 0 || settlementMPP > 0 || otherIncomeMPP > 0 || totalExpensesMPP > 0;

    return {
      fuelSalesNoMPP,
      fuelLitersNoMPP,
      fuelSalesMPP,
      fuelLitersMPP,
      fuelSalesByTypeNoMPP,
      fuelSalesByTypeMPP,
      creditTotalAmountNoMPP,
      creditLitersNoMPP,
      creditAmountMPP,
      creditLitersMPP,
      otherIncomeNoMPP,
      otherIncomeMPP,
      totalExpensesNoMPP,
      totalExpensesMPP,
      settlementNoMPP,
      settlementMPP,
      cashInHand,
      mppCash,
      hasMPPData
    };
  };
  
  // Direct PDF generation - uses browser print for small file size
  // Direct PDF using jsPDF with built-in Helvetica (0 font embedding = small files)
  const generateDirectPDF = (mode = 'open') => {
    try {
      const todaySales = salesData.filter(s => s.date === selectedDate);
      const todayCredits = creditData.filter(c => c.date === selectedDate);
      const todaySettlements = settlementData.filter(s => s.date === selectedDate);
      const todayIncome = incomeData.filter(i => i.date === selectedDate);
      const todayExpenses = expenseData.filter(e => e.date === selectedDate);
      const todayReceipts = payments.filter(p => p.date === selectedDate);

      // Renders the report at a given scale (1.0 = full, <1 = compressed)
      const renderReport = (scale) => {
        const doc = new jsPDF({ compress: true, putOnlyUsedFonts: true });
        const pw = doc.internal.pageSize.getWidth();
        const ph = doc.internal.pageSize.getHeight();
        const fs = (n) => Math.max(3, n * scale);         // font size floor 3pt (extreme compression)
        const sp = (n) => Math.max(0.2, n * scale);       // spacing floor 0.2mm
        let y = 15;

        // Header (fixed, always readable)
        doc.setFillColor(60, 60, 60);
        doc.rect(0, 0, pw, 12, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(255, 255, 255);
        doc.text('Manager Pump', 14, 8);
        doc.setFontSize(9);
        doc.text('Date: ' + selectedDate + '  Time: ' + new Date().toLocaleTimeString(), pw - 14, 8, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        y = 18;

        // Stock line
        if (fuelSettings) {
          doc.setFontSize(fs(11));
          doc.setFont('helvetica', 'normal');
          const stockLine = 'STOCK: ' + Object.keys(fuelSettings).map(ft => {
            const sd = localStorageService.getItem(ft.toLowerCase() + 'StockData');
            let ss = 0;
            if (sd && sd[selectedDate]) ss = sd[selectedDate].startStock || 0;
            return ft + '-' + ss.toFixed(0) + ' L';
          }).join(', ');
          doc.text(stockLine, 14, y);
          y += sp(5);
        }

        // Fuel Sales line
        if (fuelSettings) {
          const fsLine = 'FUEL SALES: ' + Object.keys(fuelSettings).map(ft => {
            const fd = stats.fuelSalesByType[ft] || { liters: 0 };
            return ft + '-' + fd.liters.toFixed(0) + ' L';
          }).join(', ');
          doc.text(fsLine, 14, y);
          y += sp(7);
        }

        const tbl = { theme: 'grid', styles: { font: 'helvetica', fontSize: fs(11), cellPadding: sp(2.2), minCellHeight: sp(4), lineWidth: 0.1, lineColor: [0,0,0], textColor: [0,0,0], fillColor: [255,255,255] }, headStyles: { fillColor: [255,255,255], textColor: [0,0,0], fontStyle: 'bold', fontSize: fs(11), minCellHeight: sp(4) }, margin: { top: 10, bottom: 6, left: 14, right: 14 } };
        // Wrap each row so Sr 1 is white, Sr 2 grey, Sr 3 white, etc. Per-cell style survives all autoTable overrides.
        const stripe = (rows) => rows.map((row, idx) => {
          const fillColor = idx % 2 === 0 ? [255, 255, 255] : [245, 245, 245];
          return row.map((cell) => {
            if (cell !== null && typeof cell === 'object' && !Array.isArray(cell)) {
              return { ...cell, styles: { ...(cell.styles || {}), fillColor } };
            }
            return { content: String(cell), styles: { fillColor } };
          });
        });
        const sectionHeading = (label) => {
          if (y > ph - 20) { doc.addPage(); y = 15; }
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.text(label, 14, y + 3.5);
          // Table starts IMMEDIATELY below the heading text (no empty gap)
          y += 4.2;
        };
        const sectionGap = () => {
          if (y > ph - 20) { doc.addPage(); y = 15; }
        };

        // Summary (heading removed for space)
        sectionGap();
        doc.autoTable({ startY: y, ...tbl, head: [['Category', 'Litres', 'Amount']], body: stripe([
          ['Fuel Sales', stats.totalLiters.toFixed(2), stats.totalFuelAmount.toFixed(2)],
          ['Credit Sales', stats.creditLiters.toFixed(2), stats.creditAmount.toFixed(2)],
          ['Settlement', '-', stats.totalSettlement.toFixed(2)],
          ['Income', '-', stats.otherIncome.toFixed(2)],
          ['Expenses', '-', stats.totalExpenses.toFixed(2)],
          ['Cash in Hand', '-', stats.cashInHand.toFixed(2)]
        ]), columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } });
        y = doc.lastAutoTable.finalY + sp(6);

        // Sales Records (heading removed for space)
        if (todaySales.length > 0) {
          sectionGap();
          const salesBody = todaySales.map((s, i) => [i+1, s.nozzle + ' - ' + s.fuelType, s.startReading, s.endReading, s.testing || 0, s.rate, s.liters.toFixed(2), s.amount.toFixed(2)]);
          salesBody.push([{content: 'Total', colSpan: 6, styles: {fontStyle: 'bold'}}, stats.totalLiters.toFixed(2), stats.totalFuelAmount.toFixed(2)]);
          doc.autoTable({ startY: y, ...tbl, head: [['#', 'Description', 'Start', 'End', 'Test', 'Rate', 'Litres', 'Amount']], body: stripe(salesBody), columnStyles: { 0: {halign:'center', cellWidth: 12, overflow: 'visible'}, 2: {halign:'right'}, 3: {halign:'right'}, 4: {halign:'right'}, 5: {halign:'right'}, 6: {halign:'right'}, 7: {halign:'right'} } });
          y = doc.lastAutoTable.finalY + sp(6);
        }

        // Credit Records (heading removed for space; 'Customer' column relabelled to 'Credit')
        if (todayCredits.length > 0) {
          sectionGap();
          const creditBody = todayCredits.map((c, i) => [
            i + 1,
            c.customerName,
            c.rate || '-',
            c.liters ? c.liters.toFixed(2) : '-',
            formatCreditIE(c),
            c.amount.toFixed(2),
          ]);
          const totalIE = todayCredits.reduce((a, c) => a + creditNetIncomeExpense(c), 0);
          const totalIEStr = totalIE === 0 ? '0.00' : `${totalIE > 0 ? '+' : '-'}${Math.abs(totalIE).toFixed(2)}`;
          creditBody.push([
            { content: 'Total', colSpan: 3, styles: { fontStyle: 'bold' } },
            stats.creditLiters.toFixed(2),
            totalIEStr,
            stats.creditAmount.toFixed(2),
          ]);
          doc.autoTable({
            startY: y,
            ...tbl,
            head: [['#', 'Credit', 'Rate', 'Litres', 'Inc/Exp', 'Amount']],
            body: stripe(creditBody),
            columnStyles: {
              0: { halign: 'center', cellWidth: 12, overflow: 'visible' },
              2: { halign: 'right' },
              3: { halign: 'right' },
              4: { halign: 'right' },
              5: { halign: 'right' },
            },
          });
          y = doc.lastAutoTable.finalY + sp(1.5);
        }

        // Settlement Records
        if (todaySettlements.length > 0) {
          sectionHeading('Settlement Records');
          const settBody = todaySettlements.map((s, i) => [i+1, s.description || 'Settlement', s.amount.toFixed(2)]);
          settBody.push([{content: 'Total', colSpan: 2, styles: {fontStyle: 'bold'}}, todaySettlements.reduce((sum, s) => sum + s.amount, 0).toFixed(2)]);
          doc.autoTable({ startY: y, ...tbl, body: stripe(settBody), columnStyles: { 0: {halign:'center', cellWidth: 12, overflow: 'visible'}, 2: {halign:'right'} } });
          y = doc.lastAutoTable.finalY + sp(1.5);
        }

        // Income Records
        if (todayIncome.length > 0) {
          sectionHeading('Income Records');
          const incBody = todayIncome.map((inc, i) => [i+1, inc.description, inc.amount.toFixed(2)]);
          incBody.push([{content: 'Total', colSpan: 2, styles: {fontStyle: 'bold'}}, todayIncome.reduce((sum, i) => sum + i.amount, 0).toFixed(2)]);
          doc.autoTable({ startY: y, ...tbl, body: stripe(incBody), columnStyles: { 0: {halign:'center', cellWidth: 12, overflow: 'visible'}, 2: {halign:'right'} } });
          y = doc.lastAutoTable.finalY + sp(1.5);
        }

        // Expense Records
        if (todayExpenses.length > 0) {
          sectionHeading('Expense Records');
          const expBody = todayExpenses.map((exp, i) => [i+1, exp.description, exp.amount.toFixed(2)]);
          expBody.push([{content: 'Total', colSpan: 2, styles: {fontStyle: 'bold'}}, todayExpenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)]);
          doc.autoTable({ startY: y, ...tbl, body: stripe(expBody), columnStyles: { 0: {halign:'center', cellWidth: 12, overflow: 'visible'}, 2: {halign:'right'} } });
          y = doc.lastAutoTable.finalY + sp(1.5);
        }

        // Receipt Records
        if (todayReceipts.length > 0) {
          sectionHeading('Receipt Records');
          const recBody = todayReceipts.map((p, i) => [i+1, p.customerName || 'Unknown', p.paymentType || p.mode || '-', p.amount.toFixed(2)]);
          recBody.push([{content: 'Total', colSpan: 3, styles: {fontStyle: 'bold'}}, todayReceipts.reduce((sum, p) => sum + p.amount, 0).toFixed(2)]);
          doc.autoTable({ startY: y, ...tbl, body: stripe(recBody), columnStyles: { 0: {halign:'center', cellWidth: 12, overflow: 'visible'}, 3: {halign:'right'} } });
          y = doc.lastAutoTable.finalY + sp(1.5);
        }

        // Bank Settlement Report
        sectionHeading('Bank Settlement Report');
        const matchR = (p, kw) => { const st=(p.settlementType||'').toLowerCase(); const m=(p.mode||'').toLowerCase(); const pt=(p.paymentType||'').toLowerCase(); return st.includes(kw)||m.includes(kw)||(pt===kw); };
        const cashT = todaySettlements.filter(s=>s.description&&s.description.toLowerCase().includes('cash')).reduce((s,v)=>s+v.amount,0) + todayReceipts.filter(p=>matchR(p,'cash')).reduce((s,p)=>s+p.amount,0);
        const cardT = todaySettlements.filter(s=>s.description&&s.description.toLowerCase().includes('card')).reduce((s,v)=>s+v.amount,0) + todayReceipts.filter(p=>matchR(p,'card')).reduce((s,p)=>s+p.amount,0);
        const paytmT = todaySettlements.filter(s=>s.description&&s.description.toLowerCase().includes('paytm')).reduce((s,v)=>s+v.amount,0) + todayReceipts.filter(p=>matchR(p,'paytm')).reduce((s,p)=>s+p.amount,0);
        const phonepeT = todaySettlements.filter(s=>s.description&&s.description.toLowerCase().includes('phonepe')).reduce((s,v)=>s+v.amount,0) + todayReceipts.filter(p=>matchR(p,'phonepe')).reduce((s,p)=>s+p.amount,0);
        const dtpT = todaySettlements.filter(s=>s.description&&s.description.toLowerCase().includes('dtp')).reduce((s,v)=>s+v.amount,0) + todayReceipts.filter(p=>matchR(p,'dtp')).reduce((s,p)=>s+p.amount,0);
        const gt = cashT+cardT+paytmT+phonepeT+dtpT;
        doc.autoTable({ startY: y, ...tbl, body: stripe([['Cash', cashT.toFixed(2)],['Card', cardT.toFixed(2)],['Paytm', paytmT.toFixed(2)],['PhonePe', phonepeT.toFixed(2)],['DTP', dtpT.toFixed(2)],['Total', gt.toFixed(2)]]), columnStyles: { 1: {halign:'right'} } });

        return doc;
      };

      // Auto-fit to 2 pages: start at 1.0 scale, shrink until it fits
      let scale = 1.0;
      let doc = renderReport(scale);
      let tries = 0;
      while (doc.internal.getNumberOfPages() > 2 && scale > 0.18 && tries < 25) {
        scale -= 0.04;
        doc = renderReport(scale);
        tries += 1;
      }
      console.log('[PDF] final scale=' + scale.toFixed(2) + ' pages=' + doc.internal.getNumberOfPages());

      // Embed a JSON payload of this day's data inside the PDF metadata.
      // Another device can pick the PDF file via "Merge PDF" and re-import this
      // day's records — no need to share a separate JSON backup.
      try {
        const todaySales = salesData.filter(s => s.date === selectedDate);
        const todayCredits = creditData.filter(c => c.date === selectedDate);
        const todaySettlements = settlementData.filter(s => s.date === selectedDate);
        const todayIncome = incomeData.filter(i => i.date === selectedDate);
        const todayExpenses = expenseData.filter(e => e.date === selectedDate);
        const todayReceipts = payments.filter(p => p.date === selectedDate);
        const dayStock = {};
        if (fuelSettings) {
          Object.keys(fuelSettings).forEach(ft => {
            const key = ft.toLowerCase() + 'StockData';
            const all = localStorageService.getItem(key);
            if (all && all[selectedDate]) dayStock[key] = { [selectedDate]: all[selectedDate] };
          });
        }
        const payload = {
          version: 'MPUMP_PDF_V1',
          date: selectedDate,
          salesData: todaySales,
          creditData: todayCredits,
          settlements: todaySettlements,
          incomeData: todayIncome,
          expenseData: todayExpenses,
          payments: todayReceipts,
          stockData: dayStock,
          fuelSettings,
          customers: customers || [],
        };
        const json = JSON.stringify(payload);
        // UTF-8 safe base64
        const bytes = new TextEncoder().encode(json);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const payloadB64 = btoa(binary);
        doc.setProperties({
          title: 'Manager Pump - ' + selectedDate,
          subject: 'Daily Report',
          author: 'Manager Petrol Pump',
          creator: 'MPumpCalc',
          keywords: 'MPUMP_DATA_V1:' + payloadB64 + ':END'
        });
      } catch (e) {
        console.warn('[PDF] payload embed failed:', e);
      }

      // Save PDF
      const fileName = 'Report_' + selectedDate + '.pdf';
      
      // Check if Android WebView
      const isAndroidWebView = typeof window.MPumpCalcAndroid !== 'undefined';
      
      if (mode === 'share') {
        // SHARE flow: Android native chooser if available, else Web Share API fallback
        if (isAndroidWebView && typeof window.MPumpCalcAndroid.sharePdf === 'function') {
          try {
            const base64 = doc.output('dataurlstring').split(',')[1];
            window.MPumpCalcAndroid.sharePdf(base64, fileName);
            toast({ title: "Opening share sheet…", description: fileName });
          } catch (bridgeError) {
            console.warn('Share bridge failed:', bridgeError);
            toast({ title: "Share failed", description: bridgeError.message, variant: "destructive" });
          }
        } else if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
          // Web Share API (modern browsers on Android/iOS)
          const blob = doc.output('blob');
          const shareFile = new File([blob], fileName, { type: 'application/pdf' });
          if (navigator.canShare({ files: [shareFile] })) {
            navigator.share({ files: [shareFile], title: fileName, text: 'Daily Report - ' + fileName })
              .then(() => toast({ title: "Shared", description: fileName }))
              .catch((err) => { if (err.name !== 'AbortError') toast({ title: "Share cancelled" }); });
          } else {
            doc.save(fileName);
            toast({ title: "Share not supported, downloaded instead", description: fileName });
          }
        } else {
          doc.save(fileName);
          toast({ title: "Share not supported, downloaded instead", description: fileName });
        }
      } else if (isAndroidWebView) {
        // Android: try JS bridge first, fallback to print dialog
        try {
          const base64 = doc.output('dataurlstring').split(',')[1];
          window.MPumpCalcAndroid.openPdfWithViewer(base64, fileName);
          toast({ title: "PDF Downloaded", description: fileName + ' saved to Downloads' });
        } catch (bridgeError) {
          console.warn('JS bridge failed, using print dialog:', bridgeError);
          const pdfBlob = doc.output('bloburl');
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write('<html><head><title>' + fileName + '</title></head><body style="margin:0"><embed width="100%" height="100%" src="' + pdfBlob + '" type="application/pdf"></body></html>');
            printWindow.document.close();
          }
        }
      } else {
        // Desktop browser: (1) download the jsPDF file, (2) open a print window
        // showing the SAME PDF so "Save as PDF" from that window yields identical output.
        doc.save(fileName);
        toast({ title: "PDF Downloaded", description: fileName });

        const pdfBlobUrl = doc.output('bloburl');
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (printWindow) {
          printWindow.document.write(
            '<!DOCTYPE html><html><head><title>' + fileName + '</title>' +
            '<style>html,body{margin:0;padding:0;height:100%;width:100%;overflow:hidden;background:#525659}' +
            'iframe{border:0;width:100%;height:100%}</style></head>' +
            '<body><iframe id="pdfFrame" src="' + pdfBlobUrl + '"></iframe>' +
            '<script>' +
            'var f=document.getElementById("pdfFrame");' +
            'f.onload=function(){setTimeout(function(){try{f.contentWindow.focus();f.contentWindow.print();}catch(e){window.print();}},400);};' +
            '</script></body></html>'
          );
          printWindow.document.close();
        }
      }
    } catch (error) {
      console.error('PDF error:', error);
      toast({ title: "PDF Failed", description: error.message, variant: "destructive" });
    }
  };
  const exportToPDF = () => {
    try {
      // Check if running in Android WebView
      const isAndroid = typeof window.MPumpCalcAndroid !== 'undefined';
      
      if (isAndroid) {
        // Generate PDF using jsPDF and pass to Android
        generatePDFForAndroid();
        return;
      }
      
      // Get today's data for web version
      const todaySales = salesData.filter(sale => sale.date === selectedDate);
      const todayCredits = creditData.filter(credit => credit.date === selectedDate);
      const todayIncome = incomeData.filter(income => income.date === selectedDate);
      const todayExpenses = expenseData.filter(expense => expense.date === selectedDate);

      // Create formatted HTML content with simplified markup
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<title>Daily Report - ${selectedDate}</title>
<style>
*{font-family:Helvetica,Arial,sans-serif;font-weight:normal}
body{margin:10px;line-height:1.2;color:#000;font-size:12px}
h1{font-size:18px;margin:0;text-align:center;text-transform:uppercase}
p{font-size:12px;margin:2px 0;text-align:center}
.s{margin:10px 0 3px 0;font-size:12px;text-transform:uppercase}
table{width:100%;border-collapse:collapse;font-size:10px;margin:3px 0}
th{border:1px solid #000;padding:2px;text-align:center;font-size:10px;text-transform:uppercase}
td{border:1px solid #000;padding:2px;font-size:10px}
.r{text-align:right}
.c{text-align:center}
.t{}
.print-btn{background:#000;color:white;border:none;padding:10px 20px;font-size:16px;cursor:pointer;margin:10px auto;display:block}
.no-print{display:block}
@media print{body{margin:5mm}.no-print{display:none}@page{margin:5mm}}
</style>
</head>
<body>
<h1>Daily Report</h1>
<p>Date: ${selectedDate}</p>

<p style="font-size:16px;margin:8px 0;font-weight:bold;color:#000">
STOCK: ${fuelSettings ? Object.keys(fuelSettings).map(fuelType => {
  const storageKey = fuelType.toLowerCase() + 'StockData';
  const savedData = localStorageService.getItem(storageKey);
  let startStock = 0;
  if (savedData) {
    const dateData = savedData[selectedDate];
    if (dateData) {
      startStock = dateData.startStock || 0;
    }
  }
  return fuelType + '-' + startStock.toFixed(0) + ' L';
}).join(', ') : 'N/A'}
</p>

<p style="font-size:16px;margin:8px 0;font-weight:bold;color:#000">
FUEL SALES: ${fuelSettings ? Object.keys(fuelSettings).map(fuelType => {
  const fuelData = stats.fuelSalesByType[fuelType] || { liters: 0, amount: 0 };
  return fuelType + '-' + fuelData.liters.toFixed(0) + ' L';
}).join(', ') : 'N/A'}
</p>

<div class="s">SUMMARY</div>
<table>
<tr><th>Category<th>Litres<th>Amount</tr>
<tr><td>1. Fuel Sales<td class="r">${stats.totalLiters.toFixed(2)}<td class="r">${stats.totalFuelAmount.toFixed(2)}</tr>
<tr><td>2. Credit Sales<td class="r">${stats.creditLiters.toFixed(2)}<td class="r">${stats.creditAmount.toFixed(2)}</tr>
<tr><td>3. Settlement<td class="r">-<td class="r">${stats.totalSettlement.toFixed(2)}</tr>
<tr><td>4. Income<td class="r">-<td class="r">${stats.otherIncome.toFixed(2)}</tr>
<tr><td>5. Expenses<td class="r">-<td class="r">${stats.totalExpenses.toFixed(2)}</tr>
<tr class="t"><td>Cash in Hand<td class="r">-<td class="r">${stats.cashInHand.toFixed(2)}</tr>
</table>

${todaySales.length > 0 ? `
<div class="s">SALES RECORDS</div>
<table>
<tr><th width="8%">Sr.No<th width="18%">Description<th width="11%">Start<th width="11%">End<th width="9%">Testing<th width="11%">Rate<th width="11%">Litres<th width="11%">Amount</tr>
${todaySales.map((sale, index) => 
  `<tr><td class="c">${index + 1}<td>${sale.nozzle} - ${sale.fuelType}<td class="r">${sale.startReading}<td class="r">${sale.endReading}<td class="r">${sale.testing || 0}<td class="r">${sale.rate}<td class="r">${sale.liters}<td class="r">${sale.amount.toFixed(2)}</tr>`
).join('')}
<tr class="t"><td colspan="6" class="r">Total:<td class="r">${todaySales.reduce((sum, sale) => sum + parseFloat(sale.liters), 0).toFixed(2)}<td class="r">${todaySales.reduce((sum, sale) => sum + parseFloat(sale.amount), 0).toFixed(2)}</tr>
</table>` : ''}

${todayCredits.length > 0 ? `
<div class="s">CREDIT RECORDS</div>
<table>
<tr><th width="6%">Sr.No<th width="34%">Customer<th width="13%">Rate<th width="13%">Litres<th width="14%">Inc/Exp<th width="20%">Amount</tr>
${todayCredits.map((credit, index) => 
  `<tr><td class="c">${index + 1}<td>${credit.customerName}<td class="r">${credit.rate}<td class="r">${credit.liters}<td class="r">${formatCreditIE(credit)}<td class="r">${credit.amount.toFixed(2)}</tr>`
).join('')}
${(() => {
  const net = todayCredits.reduce((a, c) => a + creditNetIncomeExpense(c), 0);
  const netStr = net === 0 ? '0.00' : `${net > 0 ? '+' : '-'}${Math.abs(net).toFixed(2)}`;
  return `<tr class="t"><td colspan="3" class="r">Total:<td class="r">${todayCredits.reduce((sum, credit) => sum + parseFloat(credit.liters), 0).toFixed(2)}<td class="r">${netStr}<td class="r">${todayCredits.reduce((sum, credit) => sum + parseFloat(credit.amount), 0).toFixed(2)}</tr>`;
})()}
</table>` : ''}

${settlementData.filter(s => s.date === selectedDate).length > 0 ? `
<div class="s">SETTLEMENT RECORDS</div>
<table>
<tr><th width="10%">Sr.No<th width="60%">Description<th width="30%">Amount</tr>
${settlementData.filter(s => s.date === selectedDate).map((settlement, index) => 
  `<tr><td class="c">${index + 1}<td>${settlement.description || 'Settlement'}<td class="r">${settlement.amount.toFixed(2)}</tr>`
).join('')}
<tr class="t"><td colspan="2" class="r">Total Settlements:<td class="r">${settlementData.filter(s => s.date === selectedDate).reduce((sum, s) => sum + parseFloat(s.amount), 0).toFixed(2)}</tr>
</table>` : ''}

${todayIncome.length > 0 ? `
<div class="s">INCOME RECORDS</div>
<table>
<tr><th width="10%">Sr.No<th width="70%">Description<th width="20%">Amount</tr>
${todayIncome.map((income, index) => 
  `<tr><td class="c">${index + 1}<td>${income.description}<td class="r">${income.amount.toFixed(2)}</tr>`
).join('')}
<tr class="t"><td colspan="2" class="r">Total Income:<td class="r">${todayIncome.reduce((sum, income) => sum + parseFloat(income.amount), 0).toFixed(2)}</tr>
</table>` : ''}

${todayExpenses.length > 0 ? `
<div class="s">EXPENSE RECORDS</div>
<table>
<tr><th width="10%">Sr.No<th width="70%">Description<th width="20%">Amount</tr>
${todayExpenses.map((expense, index) => 
  `<tr><td class="c">${index + 1}<td>${expense.description}<td class="r">${expense.amount.toFixed(2)}</tr>`
).join('')}
<tr class="t"><td colspan="2" class="r">Total Expenses:<td class="r">${todayExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0).toFixed(2)}</tr>
</table>` : ''}

${(() => {
  const todayReceipts = payments.filter(p => p.date === selectedDate);
  if (todayReceipts.length === 0) return '';
  const totalReceipts = todayReceipts.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  return `
<div class="s">RECEIPT RECORDS</div>
<table>
<tr><th width="8%">Sr.No<th width="32%">Customer<th width="20%">Payment Type<th width="20%">Settlement Type<th width="20%">Amount</tr>
${todayReceipts.map((p, index) => 
  `<tr><td class="c">${index + 1}<td>${p.customerName || 'Unknown'}<td class="c">${p.paymentType || p.mode || 'N/A'}<td class="c">${p.paymentType === 'Settlement' ? (p.settlementType || p.mode || '') : '-'}<td class="r">${p.amount.toFixed(2)}</tr>`
).join('')}
<tr class="t"><td colspan="4" class="r">Total Receipts:<td class="r">${totalReceipts.toFixed(2)}</tr>
</table>`;
})()}

<div class="s">BANK SETTLEMENT REPORT</div>
<table>
<tr><th width="60%">Payment Mode<th width="40%">Amount</tr>
${(() => {
  const todaySettlements = settlementData.filter(s => s.date === selectedDate);
  const todayPayments = payments.filter(p => p.date === selectedDate);
  
  // Helper: check if a receipt matches a category
  const matchReceipt = (p, keyword) => {
    const st = (p.settlementType || '').toLowerCase();
    const mode = (p.mode || '').toLowerCase();
    const pt = (p.paymentType || '').toLowerCase();
    return st.includes(keyword) || mode.includes(keyword) || (pt === keyword);
  };

  const cash = todaySettlements
    .filter(s => s.description && s.description.toLowerCase().includes('cash'))
    .reduce((sum, s) => sum + (s.amount || 0), 0)
    + todayPayments.filter(p => matchReceipt(p, 'cash'))
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  
  const card = todaySettlements
    .filter(s => s.description && s.description.toLowerCase().includes('card'))
    .reduce((sum, s) => sum + (s.amount || 0), 0)
    + todayPayments.filter(p => matchReceipt(p, 'card'))
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  
  const paytm = todaySettlements
    .filter(s => s.description && s.description.toLowerCase().includes('paytm'))
    .reduce((sum, s) => sum + (s.amount || 0), 0)
    + todayPayments.filter(p => matchReceipt(p, 'paytm'))
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  
  const phonepe = todaySettlements
    .filter(s => s.description && s.description.toLowerCase().includes('phonepe'))
    .reduce((sum, s) => sum + (s.amount || 0), 0)
    + todayPayments.filter(p => matchReceipt(p, 'phonepe'))
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  
  const dtp = todaySettlements
    .filter(s => s.description && s.description.toLowerCase().includes('dtp'))
    .reduce((sum, s) => sum + (s.amount || 0), 0)
    + todayPayments.filter(p => matchReceipt(p, 'dtp'))
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  
  const total = cash + card + paytm + phonepe + dtp;
  
  return `
    <tr><td>Cash<td class="r">${cash.toFixed(2)}</tr>
    <tr><td>Card<td class="r">${card.toFixed(2)}</tr>
    <tr><td>Paytm<td class="r">${paytm.toFixed(2)}</tr>
    <tr><td>PhonePe<td class="r">${phonepe.toFixed(2)}</tr>
    <tr><td>DTP<td class="r">${dtp.toFixed(2)}</tr>
    <tr class="t"><td>Total<td class="r">${total.toFixed(2)}</tr>
  `;
})()}
</table>

<div style="margin-top:15px;text-align:center;font-size:10px;border-top:1px solid #000;padding-top:5px">
Generated on: ${new Date().toLocaleString()}
</div>

<div class="no-print" style="text-align:center;margin:20px 0">
<button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
</div>

<script>
// Auto print on load (with delay for content loading)
window.onload = function() {
  setTimeout(() => {
    window.print();
  }, 500);
};
</script>
</body>
</html>`;

      // Open in new window for printing/PDF generation
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) {
        alert('Please allow pop-ups for this site to enable PDF export and printing.');
        return;
      }
      
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      // Focus window
      printWindow.focus();

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  // Generate PDF for Android WebView using jsPDF
  const generatePDFForAndroid = () => {
    try {
      const todaySales = salesData.filter(sale => sale.date === selectedDate);
      const todayCredits = creditData.filter(credit => credit.date === selectedDate);
      const todayIncome = incomeData.filter(income => income.date === selectedDate);
      const todayExpenses = expenseData.filter(expense => expense.date === selectedDate);
      
      // Use the global stats which already has MPP separation
      const currentStats = stats;

      // Create PDF using jsPDF
      const doc = new jsPDF({ compress: true, putOnlyUsedFonts: true });

      // Minimal table styling defaults
      const tableDefaults = { lineWidth: 0.1, lineColor: [0, 0, 0], cellPadding: 1 };
      let yPos = 20;

      // Title
      doc.setFontSize(18);
      doc.text('M.Pump Calc Daily Report', 105, yPos, { align: 'center' });
      yPos += 10;

      // Date
      doc.setFontSize(12);
      doc.text(`Date: ${selectedDate}`, 105, yPos, { align: 'center' });
      yPos += 8;

      // Stock Summary
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      const stockSummaryText = fuelSettings ? Object.keys(fuelSettings).map(fuelType => {
        const storageKey = `${fuelType.toLowerCase()}StockData`;
        const savedData = localStorageService.getItem(storageKey);
        let startStock = 0;
        if (savedData) {
          const dateData = savedData[selectedDate];
          if (dateData) {
            startStock = dateData.startStock || 0;
          }
        }
        return `${fuelType}-${startStock.toFixed(0)} L`;
      }).join(', ') : 'N/A';
      doc.text(`STOCK: ${stockSummaryText}`, 105, yPos, { align: 'center' });
      doc.setTextColor(0, 0, 0); // Reset to black
      yPos += 15;

      // FUEL SALES single line above summary
      if (fuelSettings) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        const fuelSalesLine = 'FUEL SALES: ' + Object.keys(fuelSettings).map(fuelType => {
          const fuelData = currentStats.fuelSalesByType ? (currentStats.fuelSalesByType[fuelType] || { liters: 0, amount: 0 }) : { liters: 0, amount: 0 };
          return `${fuelType}-${fuelData.liters.toFixed(0)} L`;
        }).join(', ');
        doc.text(fuelSalesLine, 14, yPos);
        doc.setTextColor(0, 0, 0);
        yPos += 8;
      }

      // Summary Section
      doc.setFontSize(14);
      doc.text('SUMMARY', 14, yPos);
      yPos += 5;

      const summaryData = [];
      let rowNum = 1;
      
      // Fuel Sales (all combined)
      summaryData.push([
        `${rowNum}. Fuel Sales`,
        currentStats.totalLiters.toFixed(2),
        `${currentStats.totalFuelAmount.toFixed(2)}`
      ]);
      rowNum++;

      // Credit Sales
      summaryData.push([
        `${rowNum}. Credit Sales`,
        currentStats.creditLiters.toFixed(2),
        `${currentStats.creditAmount.toFixed(2)}`
      ]);
      rowNum++;

      // Settlement
      summaryData.push([
        `${rowNum}. Settlement`,
        '-',
        `${currentStats.totalSettlement.toFixed(2)}`
      ]);
      rowNum++;

      // Income
      summaryData.push([
        `${rowNum}. Income`,
        '-',
        `${currentStats.otherIncome.toFixed(2)}`
      ]);
      rowNum++;

      // Expenses
      summaryData.push([
        `${rowNum}. Expenses`,
        '-',
        `${currentStats.totalExpenses.toFixed(2)}`
      ]);
      rowNum++;

      // Cash in Hand
      summaryData.push([
        { content: 'Cash in Hand', styles: { fontStyle: 'bold' } },
        '-',
        { content: `${currentStats.cashInHand.toFixed(2)}`, styles: { fontStyle: 'bold' } }
      ]);

      doc.autoTable({
        startY: yPos,
        head: [[
          'Category',
          { content: 'Litres', styles: { halign: 'center' } },
          { content: 'Amount', styles: { halign: 'center' } }
        ]],
        body: summaryData,
        theme: 'plain',
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { halign: 'right', cellWidth: 30 },
          2: { halign: 'right', cellWidth: 40 }
        }
      });

      yPos = doc.lastAutoTable.finalY + 10;

      // Sales Records
      if (todaySales.length > 0 && yPos < 250) {
        doc.setFontSize(14);
        doc.text('SALES RECORDS', 14, yPos);
        yPos += 5;

        const salesTableData = todaySales.map((sale, index) => [
          index + 1,
          `${sale.nozzle} - ${sale.fuelType}`,
          sale.startReading,
          sale.endReading,
          sale.testing || 0,
          sale.rate,
          sale.liters,
          sale.amount.toFixed(2)
        ]);

        doc.autoTable({
          startY: yPos,
          head: [['#', 'Description', 'Start', 'End', 'Testing', 'Rate', 'Litres', 'Amount']],
          body: salesTableData,
          theme: 'grid',
          headStyles: { fillColor: false, textColor: [0, 0, 0] },
          styles: { ...tableDefaults, fontSize: 9 }
        });

        yPos = doc.lastAutoTable.finalY + 10;
      }

      // Add new page if needed
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Credit Records
      if (todayCredits.length > 0 && yPos < 250) {
        doc.setFontSize(14);
        doc.text('CREDIT RECORDS', 14, yPos);
        yPos += 5;

        const creditTableData = todayCredits.map((credit, index) => [
          index + 1,
          credit.customerName,
          credit.vehicleNumber || 'N/A',
          credit.rate,
          credit.liters,
          formatCreditIE(credit),
          credit.amount.toFixed(2)
        ]);

        doc.autoTable({
          startY: yPos,
          head: [['#', 'Customer', 'Vehicle', 'Rate', 'Litres', 'Inc/Exp', 'Amount']],
          body: creditTableData,
          theme: 'grid',
          headStyles: { fillColor: false, textColor: [0, 0, 0] },
          styles: { ...tableDefaults, fontSize: 9 }
        });

        yPos = doc.lastAutoTable.finalY + 10;
      }

      // Add new page if needed
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Settlement Records (moved here after credits)
      const todaySettlements = settlementData.filter(s => s.date === selectedDate);
      if (todaySettlements.length > 0 && yPos < 250) {
        doc.setFontSize(14);
        doc.text('SETTLEMENT RECORDS', 14, yPos);
        yPos += 5;

        const settlementTableData = todaySettlements.map((settlement, index) => [
          index + 1,
          settlement.description || 'Settlement',
          settlement.amount.toFixed(2),
          settlement.mpp ? 'Yes' : 'No'
        ]);

        doc.autoTable({
          startY: yPos,
          head: [['#', 'Description', 'Amount', 'MPP']],
          body: settlementTableData,
          theme: 'grid',
          headStyles: { fillColor: false, textColor: [0, 0, 0] },
          styles: { ...tableDefaults, fontSize: 9 }
        });

        yPos = doc.lastAutoTable.finalY + 10;
      }

      // Add new page if needed
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Income Records
      if (todayIncome.length > 0 && yPos < 250) {
        doc.setFontSize(14);
        doc.text('INCOME RECORDS', 14, yPos);
        yPos += 5;

        const incomeTableData = todayIncome.map((income, index) => [
          index + 1,
          income.description,
          income.amount.toFixed(2)
        ]);

        doc.autoTable({
          startY: yPos,
          head: [['#', 'Description', 'Amount']],
          body: incomeTableData,
          theme: 'grid',
          headStyles: { fillColor: false, textColor: [0, 0, 0] },
          styles: { ...tableDefaults, fontSize: 9 }
        });

        yPos = doc.lastAutoTable.finalY + 10;
      }

      // Add new page if needed
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Expense Records
      if (todayExpenses.length > 0 && yPos < 250) {
        doc.setFontSize(14);
        doc.text('EXPENSE RECORDS', 14, yPos);
        yPos += 5;

        const expenseTableData = todayExpenses.map((expense, index) => [
          index + 1,
          expense.description,
          expense.amount.toFixed(2)
        ]);

        doc.autoTable({
          startY: yPos,
          head: [['#', 'Description', 'Amount']],
          body: expenseTableData,
          theme: 'grid',
          headStyles: { fillColor: false, textColor: [0, 0, 0] },
          styles: { ...tableDefaults, fontSize: 9 }
        });

        yPos = doc.lastAutoTable.finalY + 10;
      }

      // RECEIPT RECORDS
      const todayReceipts = payments.filter(p => p.date === selectedDate);
      if (todayReceipts.length > 0) {
        if (yPos > 250) { doc.addPage(); yPos = 20; }

        doc.setFontSize(14);
        doc.text('RECEIPT RECORDS', 14, yPos);
        yPos += 5;

        const receiptTableData = todayReceipts.map((p, index) => [
          index + 1,
          p.customerName || 'Unknown',
          p.paymentType || p.mode || 'N/A',
          p.paymentType === 'Settlement' ? (p.settlementType || '') : '-',
          p.amount.toFixed(2)
        ]);

        doc.autoTable({
          startY: yPos,
          head: [['#', 'Customer', 'Payment Type', 'Settlement Type', 'Amount']],
          body: receiptTableData,
          theme: 'grid',
          headStyles: { fillColor: false, textColor: [0, 0, 0] },
          styles: { ...tableDefaults, fontSize: 9 }
        });

        yPos = doc.lastAutoTable.finalY + 10;
      }

      // Add new page if needed
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Bank Settlement Report (at end)
      doc.setFontSize(14);
      doc.text('BANK SETTLEMENT REPORT', 14, yPos);
      yPos += 5;
      
      // Helper: check if a receipt matches a category
      const todayPayments = payments.filter(p => p.date === selectedDate);
      const matchReceipt = (p, keyword) => {
        const st = (p.settlementType || '').toLowerCase();
        const mode = (p.mode || '').toLowerCase();
        const pt = (p.paymentType || '').toLowerCase();
        return st.includes(keyword) || mode.includes(keyword) || (pt === keyword);
      };

      const cashTotal = todaySettlements
        .filter(s => s.description && s.description.toLowerCase().includes('cash'))
        .reduce((sum, s) => sum + (s.amount || 0), 0)
        + todayPayments.filter(p => matchReceipt(p, 'cash'))
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      
      const cardTotal = todaySettlements
        .filter(s => s.description && s.description.toLowerCase().includes('card'))
        .reduce((sum, s) => sum + (s.amount || 0), 0)
        + todayPayments.filter(p => matchReceipt(p, 'card'))
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      
      const paytmTotal = todaySettlements
        .filter(s => s.description && s.description.toLowerCase().includes('paytm'))
        .reduce((sum, s) => sum + (s.amount || 0), 0)
        + todayPayments.filter(p => matchReceipt(p, 'paytm'))
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      
      const phonepeTotal = todaySettlements
        .filter(s => s.description && s.description.toLowerCase().includes('phonepe'))
        .reduce((sum, s) => sum + (s.amount || 0), 0)
        + todayPayments.filter(p => matchReceipt(p, 'phonepe'))
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      
      const dtpTotal = todaySettlements
        .filter(s => s.description && s.description.toLowerCase().includes('dtp'))
        .reduce((sum, s) => sum + (s.amount || 0), 0)
        + todayPayments.filter(p => matchReceipt(p, 'dtp'))
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      
      const bankSettlementData = [
        ['Cash', `${cashTotal.toFixed(2)}`],
        ['Card', `${cardTotal.toFixed(2)}`],
        ['Paytm', `${paytmTotal.toFixed(2)}`],
        ['PhonePe', `${phonepeTotal.toFixed(2)}`],
        ['DTP', `${dtpTotal.toFixed(2)}`]
      ];
      
      const grandTotal = cashTotal + cardTotal + paytmTotal + phonepeTotal + dtpTotal;
      bankSettlementData.push([
        { content: 'Total', styles: { fontStyle: 'bold' } },
        { content: `${grandTotal.toFixed(2)}`, styles: { fontStyle: 'bold', halign: 'right' } }
      ]);

      doc.autoTable({
        startY: yPos,
        head: [['Payment Mode', 'Amount']],
        body: bankSettlementData,
        theme: 'plain',
        headStyles: { textColor: [0, 0, 0] },
        styles: { ...tableDefaults, fontSize: 10 }
      });

      yPos = doc.lastAutoTable.finalY + 10;

      // Get PDF as Base64
      const pdfBase64 = doc.output('dataurlstring').split(',')[1];
      const fileName = `Report_${selectedDate}.pdf`;

      // Call Android native method to save PDF
      if (window.MPumpCalcAndroid && window.MPumpCalcAndroid.openPdfWithViewer) {
        window.MPumpCalcAndroid.openPdfWithViewer(pdfBase64, fileName);
      }
    } catch (error) {
      console.error('Error generating PDF for Android:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  // Debug function removed

  // CSV export function removed per user request

  const copyToClipboard = () => {
    const textContent = generateTextContent();
    navigator.clipboard.writeText(textContent).then(() => {
      alert('Daily report copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy: ', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = textContent;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Daily report copied to clipboard!');
    });
  };

  // PDF export content generation function removed

  // CSV content generation function removed per user request

  const generateTextContent = () => {
    const todaySales = salesData.filter(sale => sale.date === selectedDate);
    const todayCredits = creditData.filter(credit => credit.date === selectedDate);
    const todayIncome = incomeData.filter(income => income.date === selectedDate);
    const todayExpenses = expenseData.filter(expense => expense.date === selectedDate);

    let text = `Date: ${selectedDate}\n\n`;
    
    // Summary section
    text += `*Summary*\n`;
    Object.entries(stats.fuelSalesByType).forEach(([fuelType, data]) => {
      text += `${fuelType} Sales: ${data.liters.toFixed(2)}L - ${data.amount.toFixed(2)}\n`;
    });
    text += `Credit Sales: ${stats.creditLiters.toFixed(2)}L - ${stats.creditAmount.toFixed(2)}\n`;
    text += `Income: ${stats.otherIncome.toFixed(2)}\n`;
    text += `Expenses: ${stats.totalExpenses.toFixed(2)}\n`;
    text += `Cash in Hand: ${stats.cashInHand.toFixed(2)}\n`;
    text += `-------\n\n`;
    
    // *Readings* section
    if (todaySales.length > 0) {
      text += `*Readings*\n`;
      todaySales.forEach((sale, index) => {
        text += `${index + 1}. Readings:\n`;
        text += ` Description: ${sale.nozzle}\n`;
        text += ` Starting: ${sale.startReading}\n`;
        text += ` Ending: ${sale.endReading}\n`;
        text += ` Litres: ${sale.liters}\n`;
        text += ` Rate: ${sale.rate}\n`;
        text += ` Amount: ${sale.amount.toFixed(2)}\n`;
      });
      text += `*Readings Total: ${stats.fuelCashSales.toFixed(2)}*\n`;
      text += `-------\n`;
    }
    
    // *Credits* section
    if (todayCredits.length > 0) {
      text += `*Credits*\n`;
      todayCredits.forEach((credit, index) => {
        text += `${index + 1}. Credit:\n`;
        text += ` Description: ${credit.customerName}\n`;
        text += ` Litre: ${credit.liters}\n`;
        text += ` Rate: ${credit.rate}\n`;
        text += ` Amount: ${credit.amount.toFixed(2)}\n`;
      });
      text += `*Credits Total: ${stats.creditAmount.toFixed(2)}*\n`;
      text += `-------\n`;
    }
    
    // *Income* section
    if (todayIncome.length > 0) {
      text += `*Income*\n`;
      todayIncome.forEach((income, index) => {
        text += `${index + 1}. Income:\n`;
        text += ` ${income.description}: ${income.amount.toFixed(2)}\n`;
      });
      text += `*Income Total: ${stats.otherIncome.toFixed(2)}*\n`;
      text += `-------\n`;
    }
    
    // *Expenses* section
    if (todayExpenses.length > 0) {
      text += `*Expenses*\n`;
      todayExpenses.forEach((expense, index) => {
        text += `${index + 1}. Expenses:\n`;
        text += ` ${expense.description}: ${expense.amount.toFixed(2)}\n`;
      });
      text += `*Expenses Total: ${stats.totalExpenses.toFixed(2)}*\n`;
      text += `-------\n`;
    }
    
    text += `\n************************\n`;
    text += `*Total Amount: ${stats.cashInHand.toFixed(2)}*\n`;
    
    return text;
  };

  // Offline mode: always proceed directly

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDarkMode ? 'bg-gray-900 text-white' : 'bg-gradient-to-br from-slate-50 to-slate-100'
    }`}>
      <div className="max-w-7xl mx-auto p-2 sm:p-4">
        
        {/* Offline mode display removed per user request */}
        {/* Header */}
        <div className="flex items-center justify-between mb-1 sm:mb-2 pt-status-bar">
          {/* Left Side: Settings and App Title */}
          <div className="flex items-center gap-2 sm:gap-4">
            <HeaderSettings 
              isDarkMode={isDarkMode}
              fuelSettings={fuelSettings}
              setFuelSettings={setFuelSettings}
              customers={customers}
              onAddCustomer={handleAddCustomer}
              onDeleteCustomer={handleDeleteCustomer}
              onUpdateCustomer={handleUpdateCustomer}
            />

            {/* Hidden-trigger Settings dialog, opened by Balance → Backup tab (mount on-demand) */}
            {backupDialogOpen && (
              <HeaderSettings 
                isDarkMode={isDarkMode}
                fuelSettings={fuelSettings}
                setFuelSettings={setFuelSettings}
                customers={customers}
                onAddCustomer={handleAddCustomer}
                onDeleteCustomer={handleDeleteCustomer}
                onUpdateCustomer={handleUpdateCustomer}
                open={backupDialogOpen}
                onOpenChange={setBackupDialogOpen}
                defaultTab="backup"
                hideTrigger={true}
              />
            )}
            
            <div 
              className="flex items-center gap-2 sm:gap-3"
            >
              <div className="p-1.5 sm:p-2 bg-blue-600 rounded-full" title="M.Petrol Pump">
                <Fuel className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
              </div>
            </div>
          </div>
          
          {/* Right Side: Text Size and Dark Mode Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Sync now symbol triggering sync (green if authenticated, amber if offline/not-logged-in) */}
            <Button
              variant="outline"
              size="sm"
              onClick={currentUser ? handleManualSync : handleGoogleSignIn}
              disabled={syncBusy}
              className={`h-8 w-8 p-0 border border-slate-200 dark:border-gray-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md relative flex items-center justify-center ${syncBusy ? 'opacity-80' : ''}`}
              title={currentUser ? `Cloud Synced (${currentUser.email}) - Click to Sync Now` : "Offline (Google Sync Off) - Click to Login & Sync"}
            >
              <RefreshCw className={`w-4 h-4 ${syncBusy ? 'animate-spin' : ''} ${currentUser ? 'text-emerald-500' : 'text-amber-500'}`} />
            </Button>

            {currentUser && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGoogleSignOut}
                disabled={syncBusy}
                className="h-8 w-8 p-0 border border-slate-200 dark:border-gray-800 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md flex items-center justify-center"
                title="Logout from Google"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            )}

            {/* Text Size Controls */}
            <div className="flex items-center gap-3 sm:gap-4 border rounded-md p-1" style={{
              borderColor: isDarkMode ? '#4b5563' : '#e2e8f0'
            }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={decreaseTextSize}
                className="h-7 w-7 p-0 hover:bg-opacity-10"
                title="Decrease text size"
              >
                <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
              <span className="text-xs px-2 hidden sm:inline">{textSize}%</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={increaseTextSize}
                className="h-7 w-7 p-0 hover:bg-opacity-10"
                title="Increase text size"
              >
                <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
            </div>

            {/* Dark Mode Toggle */}
            <Button
              variant="outline"
              onClick={toggleTheme}
              className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-4"
            >
              {isDarkMode ? <Sun className="w-3 h-3 sm:w-4 sm:h-4" /> : <Moon className="w-3 h-3 sm:w-4 sm:h-4" />}
              <span className="hidden sm:inline">{isDarkMode ? 'Light' : 'Dark'}</span>
              <span className="sm:hidden">{isDarkMode ? 'L' : 'D'}</span>
            </Button>
          </div>
        </div>



        {/* --- Synchronize Conflict / Merge offline data prompt card --- */}
        {showSyncPrompt && (
          <div className="p-4 rounded-lg mb-4 border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm">
            <h4 className="font-bold text-blue-800 dark:text-blue-300 text-sm sm:text-base flex items-center gap-2 mb-1.5">
              <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Transfer Device Data to Google Cloud Account?
            </h4>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-3 leading-relaxed">
              We detected existing sales and credit records on your local device. 
              Would you like to sync them and save them to your active Google Account, or start with your clean cloud database instead?
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="default"
                onClick={handleMergeGuestData}
                disabled={syncBusy}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-xs h-8 px-3.5"
              >
                Yes, Secure Local Data to Cloud
              </Button>
              <Button
                variant="outline"
                onClick={handleDiscardMerge}
                disabled={syncBusy}
                className="text-xs sm:text-xs h-8 px-3.5"
              >
                No, Start with Cloud State
              </Button>
            </div>
          </div>
        )}

        {/* Parent Tabs: Today Summary / Balance */}
        <div className={`border-b mb-2 ${isDarkMode ? 'border-gray-700' : 'border-slate-200'}`}>
          <div className="grid grid-cols-2 gap-0">
            <button
              onClick={() => setParentTab('today')}
              className={`py-3 px-4 text-center font-semibold transition-colors ${
                parentTab === 'today'
                  ? isDarkMode
                    ? 'bg-blue-900 text-white border-b-2 border-blue-500'
                    : 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : isDarkMode
                    ? 'text-gray-400 hover:bg-gray-800'
                    : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Today Summary
            </button>
            <button
              onClick={handleBalanceTabClick}
              className={`py-3 px-4 text-center font-semibold transition-colors ${
                parentTab === 'outstanding'
                  ? isDarkMode
                    ? 'bg-blue-900 text-white border-b-2 border-blue-500'
                    : 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : isDarkMode
                    ? 'text-gray-400 hover:bg-gray-800'
                    : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Balance
            </button>
          </div>
        </div>

        {/* Date Section - Only show in Today Summary */}
        {parentTab === 'today' && (
          <Card className={`${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'
          } shadow-lg mb-2`}>
            <CardContent className="p-2 sm:p-3">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Calendar className={`w-5 h-5 sm:w-6 sm:h-6 ${
                      isDarkMode ? 'text-blue-400' : 'text-blue-600'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <Label className={`text-xs sm:text-sm font-medium ${
                        isDarkMode ? 'text-gray-300' : 'text-slate-600'
                      }`}>
                        Operating Date
                      </Label>
                      <div className={`text-sm sm:text-xl font-bold truncate ${
                        isDarkMode ? 'text-white' : 'text-slate-800'
                      }`}>
                        {formatDisplayDate(selectedDate)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNotesOpen(true)}
                      className={`text-xs h-7 px-2 ${
                        isDarkMode 
                          ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                          : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                      title="Notes"
                    >
                      <FileText className="w-3 h-3 mr-1" />
                      N
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateDirectPDF('share')}
                      data-testid="share-pdf-btn"
                      className={`text-xs h-7 px-2 ${
                        isDarkMode 
                          ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                          : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                      title="Share PDF (WhatsApp / Email / Drive)"
                      aria-label="Share PDF"
                    >
                      <Share2 className="w-3.5 h-3.5 mr-1" />
                      S
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateDirectPDF('open')}
                      className={`text-xs h-7 px-2 ${
                        isDarkMode 
                          ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                          : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyToClipboard}
                      className={`text-xs h-7 px-2 ${
                        isDarkMode 
                          ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                          : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 sm:gap-2 w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPreviousDay}
                    className={`h-8 w-8 sm:h-10 sm:w-10 p-0 flex-shrink-0 ${
                      isDarkMode ? 'border-gray-600 hover:bg-gray-700' : ''
                    }`}
                  >
                    <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                  
                  <div className={`border rounded-lg p-1 sm:p-1.5 flex-1 min-w-0 ${
                    isDarkMode 
                      ? 'border-gray-600 bg-gray-700' 
                      : 'border-slate-300 bg-white'
                  }`}>
                    <Input
                      id="date-picker"
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className={`h-6 sm:h-8 w-full border-0 bg-transparent focus:ring-0 text-xs sm:text-sm ${
                        isDarkMode ? 'text-white' : 'text-slate-800'
                      }`}
                    />
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextDay}
                    className={`h-8 w-8 sm:h-10 sm:w-10 p-0 flex-shrink-0 ${
                      isDarkMode ? 'border-gray-600 hover:bg-gray-700' : ''
                    }`}
                  >
                    <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stock Summary - Single line showing start stock */}
        {parentTab === 'today' && (
          <Card key={`stock-summary-${stockDataVersion}`} className={`${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'
          } shadow-lg mb-2`}>
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Package className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${
                  isDarkMode ? 'text-purple-400' : 'text-purple-600'
                }`} />
                <span className={`text-xs sm:text-sm font-semibold ${
                  isDarkMode ? 'text-gray-300' : 'text-slate-600'
                }`}>
                  STOCK:
                </span>
                {fuelSettings && Object.keys(fuelSettings).map((fuelType, index) => {
                  const storageKey = `${fuelType.toLowerCase()}StockData`;
                  const savedData = localStorageService.getItem(storageKey);
                  let startStock = 0;
                  
                  if (savedData) {
                    const dateData = savedData[selectedDate];
                    if (dateData) {
                      startStock = dateData.startStock || 0;
                    }
                  }
                  
                  return (
                    <span 
                      key={fuelType}
                      className={`text-xs sm:text-sm font-medium ${
                        isDarkMode ? 'text-white' : 'text-slate-800'
                      }`}
                    >
                      {fuelType}-{startStock.toFixed(0)} L{index < Object.keys(fuelSettings).length - 1 ? ', ' : ''}
                    </span>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stock and Rate Buttons - Same height as STOCK summary */}
        {parentTab === 'today' && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            {/* Stock Button */}
            <Card 
              className="bg-white border-slate-200 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
              onClick={() => setStockDialogOpen(true)}
            >
              <CardContent className="p-2 sm:p-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-purple-600" />
                  <span className="text-xs sm:text-sm font-semibold text-slate-800">
                    Add Stock
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Rate Button */}
            <Card 
              className="bg-white border-slate-200 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
              onClick={() => setRateDialogOpen(true)}
            >
              <CardContent className="p-2 sm:p-3">
                <div className="flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-green-600" />
                  <span className="text-xs sm:text-sm font-semibold text-slate-800">
                    Add Rate
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Today Summary View */}
        {parentTab === 'today' && (
          <>
            {/* Summary Section - Two Column Layout */}
        <Card className={`${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'
        } shadow-lg mb-2`}>
          <CardContent className="p-2 sm:p-3">
            <div className="grid grid-cols-2 gap-3">
              {/* LEFT COLUMN - Summary */}
              <div className="space-y-1.5 sm:space-y-2">
                {/* Summary Header */}
                <h2 className={`text-lg sm:text-2xl font-bold mb-2 ${
                  isDarkMode ? 'text-white' : 'text-slate-800'
                }`}>
                  Summary
                </h2>
                {/* Fuel Sales (No MPP) */}
                <div className={`flex items-center justify-between py-1.5 px-2 sm:py-2 sm:px-3 rounded-lg ${
                  isDarkMode ? 'bg-gray-700' : 'bg-blue-50'
                }`}>
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0">
                      1
                    </div>
                    <span className={`font-medium text-xs sm:text-base truncate ${
                      isDarkMode ? 'text-white' : 'text-slate-800'
                    }`}>
                      Fuel Sales
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-xs sm:text-lg font-bold whitespace-nowrap ${
                      isDarkMode ? 'text-white' : 'text-slate-800'
                    }`}>
                      {stats.totalLiters.toFixed(2)}L • ₹{stats.totalFuelAmount.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Credit Sales */}
                <div className={`flex justify-between items-center p-2 sm:p-3 rounded-lg border-l-4 border-orange-500 ${
                  isDarkMode ? 'bg-gray-700' : 'bg-orange-50'
                }`}>
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0">
                      2
                    </div>
                    <span className={`font-medium text-xs sm:text-base truncate ${
                      isDarkMode ? 'text-white' : 'text-slate-800'
                    }`}>
                      Credit Sales
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-xs sm:text-lg font-bold whitespace-nowrap ${
                      isDarkMode ? 'text-white' : 'text-slate-800'
                    }`}>
                      {stats.creditLiters.toFixed(2)}L • ₹{stats.creditAmount.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Income */}
                <div className={`flex items-center justify-between py-1.5 px-2 sm:py-2 sm:px-3 rounded-lg ${
                  isDarkMode ? 'bg-gray-700' : 'bg-green-50'
                }`}>
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0">
                      3
                    </div>
                    <span className={`font-medium text-xs sm:text-base truncate ${
                      isDarkMode ? 'text-white' : 'text-slate-800'
                    }`}>
                      Income
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-xs sm:text-lg font-bold whitespace-nowrap ${
                      isDarkMode ? 'text-white' : 'text-slate-800'
                    }`}>
                      ₹{stats.otherIncome.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Expenses */}
                <div className={`flex items-center justify-between py-1.5 px-2 sm:py-2 sm:px-3 rounded-lg ${
                  isDarkMode ? 'bg-gray-700' : 'bg-red-50'
                }`}>
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0">
                      4
                    </div>
                    <span className={`font-medium text-xs sm:text-base truncate ${
                      isDarkMode ? 'text-white' : 'text-slate-800'
                    }`}>
                      Expenses
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-xs sm:text-lg font-bold whitespace-nowrap ${
                      isDarkMode ? 'text-white' : 'text-slate-800'
                    }`}>
                      ₹{stats.totalExpenses.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Settlement */}
                <div className={`flex items-center justify-between py-1.5 px-2 sm:py-2 sm:px-3 rounded-lg ${
                  isDarkMode ? 'bg-gray-700' : 'bg-yellow-50'
                }`}>
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-yellow-600 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0">
                      5
                    </div>
                    <span className={`font-medium text-xs sm:text-base truncate ${
                      isDarkMode ? 'text-white' : 'text-slate-800'
                    }`}>
                      Settlement
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-xs sm:text-lg font-bold whitespace-nowrap ${
                      isDarkMode ? 'text-white' : 'text-slate-800'
                    }`}>
                      ₹{stats.totalSettlement.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Cash in Hand */}
                <div className={`flex justify-between items-center p-2 sm:p-3 rounded-lg border-l-4 border-purple-500 ${
                  isDarkMode ? 'bg-gray-700' : 'bg-purple-50'
                }`}>
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0">
                      6
                    </div>
                    <span className={`font-medium text-xs sm:text-base truncate ${
                      isDarkMode ? 'text-white' : 'text-slate-800'
                    }`}>
                      Cash in Hand
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-xs sm:text-lg font-bold whitespace-nowrap ${
                      isDarkMode ? 'text-white' : 'text-slate-800'
                    }`}>
                      ₹{stats.cashInHand.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN - Fuel Type Breakdown */}
              <div className="space-y-1.5 sm:space-y-2">
                <h2 className={`text-lg sm:text-2xl font-bold mb-2 ${
                  isDarkMode ? 'text-white' : 'text-slate-800'
                }`}>
                  Fuel Sales
                </h2>
                {fuelSettings && Object.keys(fuelSettings).map((fuelType, index) => {
                  const fuelData = stats.fuelSalesByType[fuelType] || { liters: 0, amount: 0 };
                  const colors = ['bg-blue-600', 'bg-green-600', 'bg-orange-600', 'bg-red-600', 'bg-purple-600', 'bg-teal-600'];
                  const bgColors = [
                    isDarkMode ? 'bg-gray-700' : 'bg-blue-50',
                    isDarkMode ? 'bg-gray-700' : 'bg-green-50',
                    isDarkMode ? 'bg-gray-700' : 'bg-orange-50',
                    isDarkMode ? 'bg-gray-700' : 'bg-red-50',
                    isDarkMode ? 'bg-gray-700' : 'bg-purple-50',
                    isDarkMode ? 'bg-gray-700' : 'bg-teal-50'
                  ];
                  return (
                    <div key={fuelType} className={`flex items-center justify-between py-1.5 px-2 sm:py-2 sm:px-3 rounded-lg ${bgColors[index % bgColors.length]}`}>
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <div className={`w-6 h-6 sm:w-8 sm:h-8 ${colors[index % colors.length]} rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0`}>
                          {fuelType.charAt(0)}
                        </div>
                        <span className={`font-medium text-xs sm:text-base truncate ${
                          isDarkMode ? 'text-white' : 'text-slate-800'
                        }`}>
                          {fuelType}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`text-xs sm:text-lg font-bold whitespace-nowrap ${
                          isDarkMode ? 'text-white' : 'text-slate-800'
                        }`}>
                          {fuelData.liters.toFixed(2)} L
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards section removed as requested by user */}

        {/* Quick Action Buttons - Same height as STOCK summary */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-2">
          <Card 
            className={`${
              isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'
            } border-0 shadow-lg cursor-pointer transition-colors`}
            onClick={() => {
              setEditingSaleData(null);
              setSalesDialogOpen(true);
            }}
          >
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-center gap-2">
                <Calculator className="w-4 h-4 text-white" />
                <span className="text-xs sm:text-sm font-semibold text-white">Reading Sales</span>
              </div>
            </CardContent>
          </Card>
          
          <Sheet open={salesDialogOpen} onOpenChange={setSalesDialogOpen}>
            <SheetContent side="bottom" className={`h-[90vh] ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
              <SheetHeader>
                <SheetTitle className={isDarkMode ? 'text-white' : 'text-slate-800'}>
                  {editingSaleData ? 'Edit Sale Record' : 'Add Sale Record'}
                </SheetTitle>
                <SheetDescription className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                  {editingSaleData ? 'Update fuel sale details' : 'Record new fuel sale transaction'}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 overflow-y-auto h-[calc(90vh-80px)]">
                <SalesTracker 
                  isDarkMode={isDarkMode}
                  salesData={salesData}
                  addSaleRecord={addSaleRecord}
                  updateSaleRecord={updateSaleRecord}
                  deleteSaleRecord={deleteSaleRecord}
                  fuelSettings={fuelSettings}
                  selectedDate={selectedDate}
                  creditData={creditData}
                  incomeData={incomeData}
                  expenseData={expenseData}
                  formResetKey={formResetKey}
                  editingRecord={editingSaleData}
                  onRecordSaved={handleCloseDialogs}
                  hideRecordsList={true}
                  customers={customers}
                />
              </div>
            </SheetContent>
          </Sheet>

          <Card 
            className={`${
              isDarkMode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-orange-600 hover:bg-orange-700'
            } border-0 shadow-lg cursor-pointer transition-colors`}
            onClick={() => {
              setEditingCreditData(null);
              setCreditDialogOpen(true);
            }}
          >
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-center gap-2">
                <CreditCard className="w-4 h-4 text-white" />
                <span className="text-xs sm:text-sm font-semibold text-white">Credit Sales</span>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`${
              isDarkMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-purple-600 hover:bg-purple-700'
            } border-0 shadow-lg cursor-pointer transition-colors`}
            onClick={() => {
              setEditingSettlementData(null);
              setEditingIncomeExpenseData(null);
              setSettleIncExpActiveTab('settlement');
              setSettleIncExpDialogOpen(true);
            }}
          >
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-white" />
                <span className="text-xs sm:text-sm font-semibold text-white">Settle/Inc./Exp</span>
              </div>
            </CardContent>
          </Card>
          
          <Sheet open={settleIncExpDialogOpen} onOpenChange={setSettleIncExpDialogOpen}>
            <SheetContent side="bottom" className={`h-[90vh] ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
              <Tabs value={settleIncExpActiveTab} onValueChange={setSettleIncExpActiveTab} className="w-full h-full flex flex-col">
                <TabsList className={`grid w-full grid-cols-2 mx-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <TabsTrigger value="settlement" className="flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4" />
                    Settlement
                  </TabsTrigger>
                  <TabsTrigger value="incexp" className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4" />
                    Inc./Exp.
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="settlement" className="flex-1 overflow-hidden">
                  <SheetHeader className="px-2">
                    <SheetTitle className={isDarkMode ? 'text-white' : 'text-slate-800'}>
                      {editingSettlementData ? 'Edit Settlement' : 'Add Settlement'}
                    </SheetTitle>
                    <SheetDescription className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                      {editingSettlementData ? 'Update settlement record' : 'Record daily settlement transaction'}
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-4 overflow-y-auto h-[calc(90vh-150px)] px-2">
                    <Settlement 
                      key={editingSettlementData ? editingSettlementData.id : 'new'}
                      isDarkMode={isDarkMode}
                      settlementData={settlementData}
                      addSettlementRecord={addSettlementRecord}
                      updateSettlementRecord={updateSettlementRecord}
                      deleteSettlementRecord={deleteSettlementRecord}
                      selectedDate={selectedDate}
                      formResetKey={formResetKey}
                      editingRecord={editingSettlementData}
                      onRecordSaved={handleCloseDialogs}
                      hideRecordsList={true}
                      customers={customers}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="incexp" className="flex-1 overflow-hidden">
                  <SheetHeader className="px-2">
                    <SheetTitle className={isDarkMode ? 'text-white' : 'text-slate-800'}>
                      {editingIncomeExpenseData ? 'Edit Income/Expense' : 'Add Income/Expense'}
                    </SheetTitle>
                    <SheetDescription className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                      {editingIncomeExpenseData ? 'Update income or expense record' : 'Record income or expense transaction'}
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-4 overflow-y-auto h-[calc(90vh-150px)] px-2">
                <IncomeExpense 
                  key={editingIncomeExpenseData ? editingIncomeExpenseData.id : 'new'}
                  isDarkMode={isDarkMode}
                  incomeData={incomeData}
                  addIncomeRecord={addIncomeRecord}
                  updateIncomeRecord={updateIncomeRecord}
                  deleteIncomeRecord={deleteIncomeRecord}
                  expenseData={expenseData}
                  addExpenseRecord={addExpenseRecord}
                  updateExpenseRecord={updateExpenseRecord}
                  deleteExpenseRecord={deleteExpenseRecord}
                  selectedDate={selectedDate}
                  salesData={salesData}
                  creditData={creditData}
                  formResetKey={formResetKey}
                  editingRecord={editingIncomeExpenseData}
                  onRecordSaved={handleCloseDialogs}
                  hideRecordsList={true}
                  customers={customers}
                />
              </div>
                </TabsContent>
              </Tabs>
            </SheetContent>
          </Sheet>

          {/* Separate Edit Settlement Dialog */}
          <Sheet open={editingSettlementData && settlementDialogOpen} onOpenChange={setSettlementDialogOpen}>
            <SheetContent side="bottom" className={`h-[90vh] ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
              <SheetHeader className="px-2">
                <SheetTitle className={isDarkMode ? 'text-white' : 'text-slate-800'}>
                  Edit Settlement
                </SheetTitle>
                <SheetDescription className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                  Update settlement transaction details
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 overflow-y-auto h-[calc(90vh-80px)] px-2">
                <Settlement 
                  key={editingSettlementData ? editingSettlementData.id : 'edit'}
                  isDarkMode={isDarkMode}
                  settlementData={settlementData}
                  addSettlementRecord={addSettlementRecord}
                  updateSettlementRecord={updateSettlementRecord}
                  deleteSettlementRecord={deleteSettlementRecord}
                  selectedDate={selectedDate}
                  formResetKey={formResetKey}
                  editingRecord={editingSettlementData}
                  onRecordSaved={() => {
                    setSettlementDialogOpen(false);
                    setEditingSettlementData(null);
                  }}
                  hideRecordsList={true}
                  customers={customers}
                />
              </div>
            </SheetContent>
          </Sheet>

          {/* Separate Edit Income/Expense Dialog */}
          <Sheet open={editingIncomeExpenseData && incomeExpenseDialogOpen} onOpenChange={setIncomeExpenseDialogOpen}>
            <SheetContent side="bottom" className={`h-[90vh] ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
              <SheetHeader className="px-2">
                <SheetTitle className={isDarkMode ? 'text-white' : 'text-slate-800'}>
                  {editingIncomeExpenseData?.type === 'income' ? 'Edit Income' : 'Edit Expense'}
                </SheetTitle>
                <SheetDescription className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                  {editingIncomeExpenseData?.type === 'income' ? 'Update income record details' : 'Update expense record details'}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 overflow-y-auto h-[calc(90vh-80px)] px-2">
                <IncomeExpense 
                  key={editingIncomeExpenseData ? editingIncomeExpenseData.id : 'edit'}
                  isDarkMode={isDarkMode}
                  incomeData={incomeData}
                  addIncomeRecord={addIncomeRecord}
                  updateIncomeRecord={updateIncomeRecord}
                  deleteIncomeRecord={deleteIncomeRecord}
                  expenseData={expenseData}
                  addExpenseRecord={addExpenseRecord}
                  updateExpenseRecord={updateExpenseRecord}
                  deleteExpenseRecord={deleteExpenseRecord}
                  selectedDate={selectedDate}
                  salesData={salesData}
                  creditData={creditData}
                  formResetKey={formResetKey}
                  editingRecord={editingIncomeExpenseData}
                  onRecordSaved={() => {
                    setIncomeExpenseDialogOpen(false);
                    setEditingIncomeExpenseData(null);
                  }}
                  hideRecordsList={true}
                  customers={customers}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* All Records & C Sales Tabs - Below action buttons */}
        <Tabs value={todaySubTab} onValueChange={setTodaySubTab} className="w-full mt-4">
          <TabsList className={`flex w-full mb-4 ${
            isDarkMode ? 'bg-gray-800' : 'bg-slate-100'
          }`}>
            <TabsTrigger value="all" className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm w-[50%]">
              <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>All Records</span>
            </TabsTrigger>
            <TabsTrigger value="receipt" className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm w-[50%]">
              <Receipt className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Receipt</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <UnifiedRecords 
              isDarkMode={isDarkMode}
              salesData={salesData}
              creditData={creditData}
              incomeData={incomeData}
              expenseData={expenseData}
              settlementData={settlementData}
              selectedDate={selectedDate}
              onEditSale={handleEditSale}
              deleteSaleRecord={deleteSaleRecord}
              onEditCredit={handleEditCredit}
              deleteCreditRecord={deleteCreditRecord}
              onEditIncome={(record) => handleEditIncomeExpense(record, 'income')}
              deleteIncomeRecord={deleteIncomeRecord}
              onEditExpense={(record) => handleEditIncomeExpense(record, 'expense')}
              deleteExpenseRecord={deleteExpenseRecord}
              onEditSettlement={handleEditSettlement}
              deleteSettlementRecord={deleteSettlementRecord}
            />
          </TabsContent>

          <TabsContent value="receipt">
            <PaymentReceived
              customers={customers}
              payments={payments}
              selectedDate={selectedDate}
              onAddPayment={handleAddPayment}
              onUpdatePayment={handleUpdatePayment}
              onDeletePayment={handleDeletePayment}
              isDarkMode={isDarkMode}
            />
          </TabsContent>
        </Tabs>

        {/* Stock Dialog/Sheet */}
        <Sheet open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
          <SheetContent 
            side="bottom" 
            className={`h-[90vh] w-screen max-w-none left-0 right-0 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}
            style={{ width: '100vw', maxWidth: '100vw' }}
          >
            <SheetHeader className="px-2">
              <SheetTitle className={isDarkMode ? 'text-white' : 'text-slate-800'}>
                Stock Entry
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 overflow-y-auto h-[calc(90vh-80px)] px-2">
              <MPPStock 
                isDarkMode={isDarkMode}
                selectedDate={selectedDate}
                salesData={salesData}
                fuelSettings={fuelSettings}
                onClose={() => setStockDialogOpen(false)}
                onStockSaved={() => setStockDataVersion(v => v + 1)}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Rate Dialog/Sheet */}
        <Sheet open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
          <SheetContent 
            side="bottom" 
            className={`h-[90vh] w-screen max-w-none left-0 right-0 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}
            style={{ width: '100vw', maxWidth: '100vw' }}
          >
            <SheetHeader className="px-2">
              <SheetTitle className={isDarkMode ? 'text-white' : 'text-slate-800'}>
                Rate Configuration
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 overflow-y-auto h-[calc(90vh-80px)] px-2">
              <PriceConfiguration 
                isDarkMode={isDarkMode}
                fuelSettings={fuelSettings}
                updateFuelRate={updateFuelRate}
                selectedDate={selectedDate}
                salesData={salesData}
                creditData={creditData}
                incomeData={incomeData}
                expenseData={expenseData}
                onClose={() => setRateDialogOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Notes Dialog */}
        <Sheet open={notesOpen} onOpenChange={setNotesOpen}>
          <SheetContent 
            side="bottom" 
            className={`h-[80vh] ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}
          >
            <SheetHeader className="px-2">
              <SheetTitle className={isDarkMode ? 'text-white' : 'text-slate-800'}>
                Notes
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 px-2 flex flex-col h-[calc(80vh-80px)]">
              <Textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  localStorage.setItem('mpp_notes', e.target.value);
                }}
                placeholder="Write your notes here..."
                className={`flex-1 resize-none ${
                  isDarkMode 
                    ? 'bg-gray-800 text-white border-gray-600' 
                    : 'bg-white text-slate-900 border-slate-300'
                }`}
              />
            </div>
          </SheetContent>
        </Sheet>
        </>
        )}

        {/* Credit Sales Dialog - Global (accessible from both Today and Balance tabs) */}
        <Sheet open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
          <SheetContent 
            side="bottom" 
            className={`h-[90vh] w-screen max-w-none left-0 right-0 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}
            style={{ width: '100vw', maxWidth: '100vw' }}
          >
            <SheetHeader className="px-2">
              <SheetTitle className={isDarkMode ? 'text-white' : 'text-slate-800'}>
                {editingCreditData ? 'Edit Credit Record' : 'Add Credit Record'}
              </SheetTitle>
              <SheetDescription className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                {editingCreditData ? 'Update credit sale details' : 'Record new credit sale transaction'}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 overflow-y-auto h-[calc(90vh-80px)] px-2">
              <CreditSales 
                isDarkMode={isDarkMode}
                creditData={creditData}
                addCreditRecord={addCreditRecord}
                updateCreditRecord={updateCreditRecord}
                deleteCreditRecord={deleteCreditRecord}
                fuelSettings={fuelSettings}
                selectedDate={selectedDate}
                salesData={salesData}
                incomeData={incomeData}
                expenseData={expenseData}
                formResetKey={formResetKey}
                editingRecord={editingCreditData}
                onRecordSaved={handleCloseDialogs}
                hideRecordsList={true}
                customers={customers}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Outstanding View */}
        {parentTab === 'outstanding' && (
          <div className="mt-4">
            {/* Block Layout - visible on all screens */}
            <div className="block">
              {showBalanceBlocks ? (
                <div key="balance-blocks" className="mb-4">
                  <DndContext
                    sensors={dndSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleBalanceTabDragEnd}
                  >
                    <SortableContext items={balanceTabOrder} strategy={rectSortingStrategy}>
                      <div className="grid grid-cols-2 gap-3">
                        {balanceTabOrder.map((id) => {
                          const cfg = ({
                            'reports':              { Icon: FileText,    label: 'Reports',          testid: 'balance-block-reports' },
                            'bank-settlement':      { Icon: Wallet,      label: 'Bank Settlement' },
                            'outstanding-settings': { Icon: FileText,    label: 'Outstanding' },
                            'report':               { Icon: Users,       label: 'Customer Ledger' },
                            'dsr':                  { Icon: FileText,    label: 'DSR',               testid: 'balance-block-dsr' },
                            'credit-manage':        { Icon: CreditCard,  label: 'Credit Manage' },
                            'receipt-manage':       { Icon: Receipt,     label: 'Receipt Manage' },
                            'customer-manage':      { Icon: Users,       label: 'Customer Manage' },
                            'backup':               { Icon: Wallet,      label: 'Backup',            testid: 'balance-block-backup' },
                            'cust-initial':         { Icon: Users,       label: 'Initial Balance',   testid: 'balance-block-cust-initial' },
                            'sales-report':         { Icon: TrendingUp,  label: 'Sales',             testid: 'balance-block-sales-report' },
                            'cash-tally':           { Icon: DollarSign,  label: 'Cash Tally',        testid: 'balance-block-cash-tally' },
                          })[id];
                          if (!cfg) return null;
                          const { Icon, label, testid } = cfg;
                          return (
                            <SortableTab
                              key={id}
                              id={id}
                              wiggle={wiggleMode}
                              onLongPress={() => setWiggleMode(true)}
                            >
                              <div
                                onClick={() => {
                                  if (wiggleMode) return;
                                  handleBalanceBlockClick(id);
                                }}
                                data-testid={testid}
                                className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 transform ${
                                  isDarkMode
                                    ? 'bg-gray-800 border-gray-600 hover:bg-gray-700 hover:border-gray-500 hover:scale-105'
                                    : 'bg-white border-slate-300 hover:bg-slate-50 hover:border-slate-400 hover:scale-105'
                                }`}
                                style={{ willChange: 'transform' }}
                              >
                                <div className="flex flex-col items-center text-center space-y-2">
                                  <Icon className={`w-8 h-8 ${
                                    isDarkMode ? 'text-gray-400' : 'text-slate-600'
                                  }`} />
                                  <span className={`text-sm font-medium ${
                                    isDarkMode ? 'text-gray-300' : 'text-slate-700'
                                  }`}>
                                    {label}
                                  </span>
                                </div>
                              </div>
                            </SortableTab>
                          );
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                  {wiggleMode && (
                    <div className={`mt-3 text-xs text-center px-2 py-1 rounded ${
                      isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-slate-100 text-slate-700'
                    }`}>
                      Drag to reorder. Tap Balance/Total Summary or press Back to finish.
                    </div>
                  )}
                </div>
              ) : (
                <div key="balance-content" className="mb-4">
                  {/* No helper text - just empty space */}
                </div>
              )}
            </div>

            {/* Desktop Tab Layout for screens >= 768px */}
            <div className="hidden md:block">
              <Tabs value={outstandingSubTab} onValueChange={(v) => {
                if (wiggleMode) return; // ignore tab clicks while in edit mode
                if (v === 'backup') { setBackupDialogOpen(true); return; }
                setOutstandingSubTab(v);
              }} className="w-full">
                <DndContext
                  sensors={dndSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleBalanceTabDragEnd}
                >
                  <SortableContext items={balanceTabOrder} strategy={horizontalListSortingStrategy}>
                    <TabsList className={`flex w-full mb-4 ${isDarkMode ? 'bg-gray-800' : 'bg-slate-100'}`}>
                      {balanceTabOrder.map((id) => {
                        const cfg = ({
                          'reports':              { Icon: FileText,    label: 'Reports',     testid: 'tab-reports' },
                          'bank-settlement':      { Icon: Wallet,      label: 'Bank' },
                          'outstanding-settings': { Icon: FileText,    label: 'Outstanding' },
                          'report':               { Icon: Users,       label: 'Ledger' },
                          'dsr':                  { Icon: FileText,    label: 'DSR',          testid: 'tab-dsr' },
                          'credit-manage':        { Icon: CreditCard,  label: 'Credit' },
                          'receipt-manage':       { Icon: Receipt,     label: 'Receipt' },
                          'backup':               { Icon: Wallet,      label: 'Backup',       testid: 'tab-backup' },
                          'cust-initial':         { Icon: Users,       label: 'Initial Bal.', testid: 'tab-cust-initial' },
                          'sales-report':         { Icon: TrendingUp,  label: 'Sales',        testid: 'tab-sales-report' },
                          'cash-tally':           { Icon: DollarSign,  label: 'Cash Tally',   testid: 'tab-cash-tally' },
                        })[id];
                        if (!cfg) return null;
                        const { Icon, label, testid } = cfg;
                        return (
                          <SortableTab
                            key={id}
                            id={id}
                            wiggle={wiggleMode}
                            onLongPress={() => setWiggleMode(true)}
                          >
                            <TabsTrigger
                              value={id}
                              data-testid={testid}
                              className="flex items-center justify-center gap-1 text-xs w-full"
                              style={{ width: '100%' }}
                            >
                              <Icon className="w-3 h-3" />
                              <span className="hidden lg:inline">{label}</span>
                            </TabsTrigger>
                          </SortableTab>
                        );
                      })}
                    </TabsList>
                  </SortableContext>
                </DndContext>
              </Tabs>
            </div>

            {/* Content (same for both mobile and desktop) */}
            <div className="mt-4">
              {/* Show content when blocks are hidden */}
              {!showBalanceBlocks && (
                <>
                  {outstandingSubTab === 'reports' && (
                    <ReportPreviewTab
                      isDarkMode={isDarkMode}
                      selectedDate={selectedDate}
                      setSelectedDate={setSelectedDate}
                      formatDisplayDate={formatDisplayDate}
                      goToPreviousDay={goToPreviousDay}
                      goToNextDay={goToNextDay}
                      generateDirectPDF={generateDirectPDF}
                      copyToClipboard={copyToClipboard}
                      stats={stats}
                      salesData={salesData}
                      creditData={creditData}
                      settlementData={settlementData}
                      incomeData={incomeData}
                      expenseData={expenseData}
                      payments={payments}
                      fuelSettings={fuelSettings}
                    />
                  )}

                  {outstandingSubTab === 'bank-settlement' && (
                    <BankSettlement
                      isDarkMode={isDarkMode}
                      settlementData={settlementData}
                      payments={payments}
                      creditData={creditData}
                      salesData={salesData}
                      incomeData={incomeData}
                      expenseData={expenseData}
                      selectedDate={selectedDate}
                    />
                  )}

                  {outstandingSubTab === 'outstanding-settings' && (
                    <OutstandingPDFReport
                      customers={customers}
                      creditData={creditData}
                      payments={payments}
                      isDarkMode={isDarkMode}
                      selectedDate={selectedDate}
                    />
                  )}

                  {outstandingSubTab === 'report' && (
                    <CustomerLedger
                      customers={customers}
                      creditData={creditData}
                      payments={payments}
                      salesData={salesData}
                      settlementData={settlementData}
                      incomeData={incomeData}
                      expenseData={expenseData}
                      isDarkMode={isDarkMode}
                      selectedDate={selectedDate}
                    />
                  )}

                  {outstandingSubTab === 'dsr' && (
                    <DSRReport
                      isDarkMode={isDarkMode}
                      fuelSettings={fuelSettings}
                      salesData={salesData}
                    />
                  )}

                  {outstandingSubTab === 'credit-manage' && (
                    <CreditSalesManagement 
                      isDarkMode={isDarkMode}
                      creditData={creditData}
                      fuelSettings={fuelSettings}
                      selectedDate={selectedDate}
                      onEditCredit={handleEditCredit}
                      onDeleteCredit={deleteCreditRecord}
                      onAddCredit={() => {
                        saveScrollPosition();
                        setEditingCreditData(null);
                        setCreditDialogOpen(true);
                      }}
                      customers={customers}
                    />
                  )}

                  {outstandingSubTab === 'receipt-manage' && (
                    <PaymentReceived 
                      isDarkMode={isDarkMode}
                      payments={payments}
                      customers={customers}
                      onAddPayment={handleAddPayment}
                      onUpdatePayment={handleUpdatePayment}
                      onDeletePayment={handleDeletePayment}
                      selectedDate={selectedDate}
                    />
                  )}

                  {outstandingSubTab === 'customer-manage' && (
                    <CustomerManagement 
                      customers={customers}
                      onAddCustomer={handleAddCustomer}
                      onDeleteCustomer={handleDeleteCustomer}
                      onUpdateCustomer={handleUpdateCustomer}
                      isDarkMode={isDarkMode}
                    />
                  )}

                  {outstandingSubTab === 'cust-initial' && (
                    <CustomerInitialBalance
                      isDarkMode={isDarkMode}
                      customers={customers}
                      onCustomerChanged={loadData}
                    />
                  )}

                  {outstandingSubTab === 'sales-report' && (
                    <SalesReport
                      salesData={salesData}
                      creditData={creditData}
                      fuelSettings={fuelSettings}
                      isDarkMode={isDarkMode}
                    />
                  )}

                  {outstandingSubTab === 'cash-tally' && (
                    <CashOwnerTally
                      isDarkMode={isDarkMode}
                      settlementData={settlementData}
                      selectedDate={selectedDate}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* PDF Settings Dialog */}
        <Sheet open={pdfSettingsOpen} onOpenChange={setPdfSettingsOpen}>
          <SheetContent side="right" className={`w-full sm:max-w-md ${
            isDarkMode ? 'bg-gray-800 text-white' : 'bg-white'
          }`}>
            <SheetHeader>
              <SheetTitle className={isDarkMode ? 'text-white' : 'text-slate-800'}>
                PDF Export Settings
              </SheetTitle>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Content Selection */}
              <div className="space-y-3">
                <Label className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  Include in PDF
                </Label>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="includeSummary"
                      checked={pdfSettings.includeSummary}
                      onChange={(e) => setPdfSettings({...pdfSettings, includeSummary: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="includeSummary" className={isDarkMode ? 'text-gray-300' : 'text-slate-700'}>
                      Summary
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="includeSales"
                      checked={pdfSettings.includeSales}
                      onChange={(e) => setPdfSettings({...pdfSettings, includeSales: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="includeSales" className={isDarkMode ? 'text-gray-300' : 'text-slate-700'}>
                      Reading Sales
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="includeCredit"
                      checked={pdfSettings.includeCredit}
                      onChange={(e) => setPdfSettings({...pdfSettings, includeCredit: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="includeCredit" className={isDarkMode ? 'text-gray-300' : 'text-slate-700'}>
                      Credit Sales
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="includeIncome"
                      checked={pdfSettings.includeIncome}
                      onChange={(e) => setPdfSettings({...pdfSettings, includeIncome: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="includeIncome" className={isDarkMode ? 'text-gray-300' : 'text-slate-700'}>
                      Income
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="includeExpense"
                      checked={pdfSettings.includeExpense}
                      onChange={(e) => setPdfSettings({...pdfSettings, includeExpense: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="includeExpense" className={isDarkMode ? 'text-gray-300' : 'text-slate-700'}>
                      Expenses
                    </Label>
                  </div>
                </div>
              </div>

              {/* Date Range */}
              <div className="space-y-3">
                <Label className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  Date Selection
                </Label>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="singleDate"
                      name="dateRange"
                      checked={pdfSettings.dateRange === 'single'}
                      onChange={() => setPdfSettings({...pdfSettings, dateRange: 'single', startDate: selectedDate, endDate: selectedDate})}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="singleDate" className={isDarkMode ? 'text-gray-300' : 'text-slate-700'}>
                      Current Date ({selectedDate})
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="dateRange"
                      name="dateRange"
                      checked={pdfSettings.dateRange === 'range'}
                      onChange={() => setPdfSettings({...pdfSettings, dateRange: 'range'})}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="dateRange" className={isDarkMode ? 'text-gray-300' : 'text-slate-700'}>
                      Date Range
                    </Label>
                  </div>

                  {pdfSettings.dateRange === 'range' && (
                    <div className="pl-6 space-y-2">
                      <div>
                        <Label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                          Start Date
                        </Label>
                        <Input
                          type="date"
                          value={pdfSettings.startDate}
                          onChange={(e) => setPdfSettings({...pdfSettings, startDate: e.target.value})}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                          End Date
                        </Label>
                        <Input
                          type="date"
                          value={pdfSettings.endDate}
                          onChange={(e) => setPdfSettings({...pdfSettings, endDate: e.target.value})}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Format Options */}
              <div className="space-y-3">
                <Label className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  PDF Format
                </Label>
                
                <div>
                  <Label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                    Page Size
                  </Label>
                  <select
                    value={pdfSettings.pageSize}
                    onChange={(e) => setPdfSettings({...pdfSettings, pageSize: e.target.value})}
                    className={`w-full mt-1 px-3 py-2 rounded-md border ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="a4">A4 (210 x 297 mm)</option>
                    <option value="letter">Letter (216 x 279 mm)</option>
                    <option value="a5">A5 (148 x 210 mm)</option>
                  </select>
                </div>

                <div>
                  <Label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                    Orientation
                  </Label>
                  <select
                    value={pdfSettings.orientation}
                    onChange={(e) => setPdfSettings({...pdfSettings, orientation: e.target.value})}
                    className={`w-full mt-1 px-3 py-2 rounded-md border ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setPdfSettingsOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => {
                    setPdfSettingsOpen(false);
                    generateDirectPDF();
                  }}
                >
                  Generate PDF
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

      </div>
    </div>
  );
};

export default ZAPTRStyleCalculator;