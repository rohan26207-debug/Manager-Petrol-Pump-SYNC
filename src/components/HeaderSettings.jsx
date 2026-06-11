import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Settings as SettingsIcon,
  Fuel,
  Plus,
  Minus,
  Trash2,
  Save,
  RotateCcw,
  Gauge,
  User,
  Users,
  Phone,
  MapPin,
  Download,
  Upload,
  Mail,
  Globe,
  X,
  RefreshCw,
  Receipt,
  ArrowRightLeft
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { useAutoBackupWeekly } from '../hooks/use-auto-backup-weekly';
import { useConfirm } from '../hooks/use-confirm';
import localStorageService, { exportAllData, importAllData, mergeAllData } from '../services/localStorage';
import CustomerManagement from './CustomerManagement';
import IncomeExpenseCategories from './IncomeExpenseCategories';
import SettlementManagement from './SettlementManagement';

const HeaderSettings = ({ isDarkMode, fuelSettings, setFuelSettings, customers, onAddCustomer, onDeleteCustomer, onUpdateCustomer, open: openProp, onOpenChange, defaultTab = 'customer', hideTrigger = false }) => {
  const [newFuelType, setNewFuelType] = useState('');
  const [internalOpen, setInternalOpen] = useState(false);
  const settingsOpen = openProp !== undefined ? openProp : internalOpen;
  const setSettingsOpen = (v) => {
    if (onOpenChange) onOpenChange(v);
    if (openProp === undefined) setInternalOpen(v);
  };
  const [proMode, setProMode] = useState(() => {
    return localStorage.getItem('mpump_pro_mode') === 'true';
  });
  const [showProPasswordDialog, setShowProPasswordDialog] = useState(false);
  const [proPassword, setProPassword] = useState('');

  // Inline confirmation state (avoids nested-modal issues in Android WebView)
  const [clearAllConfirm, setClearAllConfirm] = useState({ open: false, typed: '' });
  const [rangeDeleteConfirm, setRangeDeleteConfirm] = useState({ open: false, fromDate: '', toDate: '' });
  const [fyBackupBusy, setFyBackupBusy] = useState(false);
  const [fyBackupYear, setFyBackupYear] = useState(() => {
    // Default to current FY (1 Apr through 31 Mar). If today is on/after Apr 1
    // current year, the FY starts this year; otherwise the previous year.
    const now = new Date();
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  });
  // Storage info state — computed on mount & when explicitly invalidated, so
  // we never re-iterate every localStorage key on each parent re-render.
  const [storageInfo, setStorageInfo] = useState(() => localStorageService.getStorageInfo());
  const refreshStorageInfo = useCallback(() => {
    setStorageInfo(localStorageService.getStorageInfo());
  }, []);
  const { toast } = useToast();
  const { confirm, confirmDialog } = useConfirm();
  
  // Auto-backup weekly hook
  const { toggleAutoBackup, getBackupStatus, backupNow } = useAutoBackupWeekly(toast);

  // Income/Expense Categories state
  const [incomeCategories, setIncomeCategories] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);

  // Settlement Types state
  const [settlementTypes, setSettlementTypes] = useState([]);

  // Load categories and settlement types on mount
  React.useEffect(() => {
    setIncomeCategories(localStorageService.getIncomeCategories());
    setExpenseCategories(localStorageService.getExpenseCategories());
    setSettlementTypes(localStorageService.getSettlementTypes());
  }, []);

  // Android back-button: if the Settings sheet (or any inline confirm) is open,
  // close it instead of letting the global handler change tabs / exit the app.
  useEffect(() => {
    const onBack = (e) => {
      if (clearAllConfirm.open) { e.preventDefault(); setClearAllConfirm({ open: false, typed: '' }); return; }
      if (rangeDeleteConfirm.open) { e.preventDefault(); setRangeDeleteConfirm({ open: false, fromDate: '', toDate: '' }); return; }
      if (showProPasswordDialog) { e.preventDefault(); setShowProPasswordDialog(false); return; }
      if (settingsOpen) { e.preventDefault(); setSettingsOpen(false); return; }
    };
    window.addEventListener('mpump-back', onBack);
    return () => window.removeEventListener('mpump-back', onBack);
  }, [settingsOpen, clearAllConfirm.open, rangeDeleteConfirm.open, showProPasswordDialog]);

  // Date-range deletion (after inline confirmation gate)
  const performRangeDelete = (fromDate, toDate) => {
    try {
      const salesData = localStorageService.getSalesData();
      const creditData = localStorageService.getCreditData();
      const incomeData = localStorageService.getIncomeData();
      const expenseData = localStorageService.getExpenseData();
      const payments = localStorageService.getPayments();
      const settlements = localStorageService.getSettlements();
      const cashOwnerEntries = localStorageService.getCashOwnerEntries();

      const filteredSales = salesData.filter(item => item.date < fromDate || item.date > toDate);
      const filteredCredits = creditData.filter(item => item.date < fromDate || item.date > toDate);
      const filteredIncome = incomeData.filter(item => item.date < fromDate || item.date > toDate);
      const filteredExpenses = expenseData.filter(item => item.date < fromDate || item.date > toDate);
      const filteredPayments = payments.filter(item => item.date < fromDate || item.date > toDate);
      const filteredSettlements = settlements.filter(item => item.date < fromDate || item.date > toDate);
      const filteredCashOwner = cashOwnerEntries.filter(item => item.date < fromDate || item.date > toDate);

      const deletedSales = salesData.length - filteredSales.length;
      const deletedCredits = creditData.length - filteredCredits.length;
      const deletedIncome = incomeData.length - filteredIncome.length;
      const deletedExpenses = expenseData.length - filteredExpenses.length;
      const deletedPayments = payments.length - filteredPayments.length;
      const deletedSettlements = settlements.length - filteredSettlements.length;
      const deletedCashOwner = cashOwnerEntries.length - filteredCashOwner.length;

      let deletedStockRecords = 0;
      const stockKeys = Object.keys(localStorage).filter(key => key.includes('StockData'));
      stockKeys.forEach(key => {
        const baseKey = key.includes(':') ? key.split(':').pop() : key;
        const stockData = localStorageService.getItem(baseKey) || {};
        Object.keys(stockData).forEach(date => {
          if (date >= fromDate && date <= toDate) {
            deletedStockRecords++;
            delete stockData[date];
          }
        });
        localStorageService.setItem(baseKey, stockData);
      });

      const totalDeleted = deletedSales + deletedCredits + deletedIncome + deletedExpenses + deletedPayments + deletedSettlements + deletedCashOwner + deletedStockRecords;

      localStorageService.setSalesData(filteredSales);
      localStorageService.setCreditData(filteredCredits);
      localStorageService.setIncomeData(filteredIncome);
      localStorageService.setExpenseData(filteredExpenses);
      localStorageService.setPayments(filteredPayments);
      localStorageService.setSettlements(filteredSettlements);
      localStorageService.setCashOwnerEntries(filteredCashOwner);

      toast({
        title: "Data Deleted Successfully",
        description: `Deleted ${totalDeleted} records (Stock: ${deletedStockRecords}, Sales: ${deletedSales}, Credits: ${deletedCredits}, Income: ${deletedIncome}, Expenses: ${deletedExpenses}, Receipts: ${deletedPayments}, Settlements: ${deletedSettlements}, Cash Tally: ${deletedCashOwner}). Refreshing...`,
      });

      const fromInput = document.getElementById('delete-from-date');
      const toInput = document.getElementById('delete-to-date');
      if (fromInput) fromInput.value = '';
      if (toInput) toInput.value = '';

      setTimeout(() => { window.location.reload(); }, 2000);
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete data. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Clear All Data handler (called after inline confirmation gate)
  const handleClearAllData = async () => {
    try {
      // Clear localStorage
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.startsWith('mpp:') || 
        key.includes('mpump') || 
        key.includes('stock') ||
        key.includes('Stock')
      );
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log('localStorage cleared:', keysToRemove.length, 'keys');

      toast({
        title: "All Data Cleared!",
        description: `Deleted ${keysToRemove.length} localStorage keys.`,
      });

      // Reload page to reset state
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error('Clear data error:', error);
      toast({
        title: "Error Clearing Data",
        description: error.message || "Failed to clear all data.",
        variant: "destructive",
      });
    }
  };

  // Category management functions
  const handleAddIncomeCategory = (name) => {
    const newCategory = localStorageService.addIncomeCategory(name);
    setIncomeCategories(localStorageService.getIncomeCategories());
    return newCategory;
  };

  const handleDeleteIncomeCategory = (id) => {
    localStorageService.deleteIncomeCategory(id);
    setIncomeCategories(localStorageService.getIncomeCategories());
  };

  const handleUpdateIncomeCategory = (id, name) => {
    localStorageService.updateIncomeCategory(id, name);
    setIncomeCategories(localStorageService.getIncomeCategories());
  };

  const handleAddExpenseCategory = (name) => {
    const newCategory = localStorageService.addExpenseCategory(name);
    setExpenseCategories(localStorageService.getExpenseCategories());
    return newCategory;
  };

  const handleDeleteExpenseCategory = (id) => {
    localStorageService.deleteExpenseCategory(id);
    setExpenseCategories(localStorageService.getExpenseCategories());
  };

  const handleUpdateExpenseCategory = (id, name) => {
    localStorageService.updateExpenseCategory(id, name);
    setExpenseCategories(localStorageService.getExpenseCategories());
  };

  // Settlement type management functions
  const handleAddSettlementType = (name) => {
    const newType = localStorageService.addSettlementType(name);
    setSettlementTypes(localStorageService.getSettlementTypes());
    return newType;
  };

  const handleDeleteSettlementType = (id) => {
    console.log('handleDeleteSettlementType called with id:', id);
    try {
      console.log('Calling localStorageService.deleteSettlementType');
      localStorageService.deleteSettlementType(id);
      console.log('Delete successful, updating state');
      const updatedTypes = localStorageService.getSettlementTypes();
      console.log('Updated settlement types:', updatedTypes);
      setSettlementTypes(updatedTypes);
      toast({
        title: "Success",
        description: "Settlement type deleted successfully.",
        variant: "default"
      });
    } catch (error) {
      console.error('Error deleting settlement type:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to delete settlement type.',
        variant: "destructive"
      });
    }
  };

  const handleProModeToggle = (checked) => {
    if (checked) {
      // Enabling Pro mode - show password dialog
      setShowProPasswordDialog(true);
    } else {
      // Disabling Pro mode - no password needed
      setProMode(false);
      localStorage.setItem('mpump_pro_mode', 'false');
      toast({
        title: "Pro Mode Disabled",
        description: "Confirmation dialogs will be shown.",
        variant: "default"
      });
    }
  };

  const handleProPasswordSubmit = () => {
    if (proPassword === '123456') {
      setProMode(true);
      localStorage.setItem('mpump_pro_mode', 'true');
      setShowProPasswordDialog(false);
      setProPassword('');
      toast({
        title: "Pro Mode Enabled",
        description: "Confirmation dialogs will be hidden.",
        variant: "default"
      });
    } else {
      toast({
        title: "Incorrect Password",
        description: "Please try again.",
        variant: "destructive"
      });
      setProPassword('');
    }
  };

  const handleUpdateSettlementType = (id, name) => {
    try {
      localStorageService.updateSettlementType(id, name);
      setSettlementTypes(localStorageService.getSettlementTypes());
      toast({
        title: "Success",
        description: "Settlement type updated successfully.",
        variant: "default"
      });
    } catch (error) {
      console.error('Error updating settlement type:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to update settlement type.',
        variant: "destructive"
      });
    }
  };

  // Employee management removed

  // Owner details state removed

  // Contact information state (static display)
  const [contactInfo, setContactInfo] = useState({
    pumpName: 'Vishnu Parvati Petroleum',
    dealerName: 'Rohan.R.Khandve',
    address: 'Station Road, Near City Mall, Mumbai - 400001',
    email: 'vishnuparvatipetroleum@gmail.com',
    website: 'https://managerpetrolpump.vercel.app/'
  });

  // Load contact info from localStorage on mount
  React.useEffect(() => {
    const savedContactInfo = localStorage.getItem('mpump_contact_info');
    if (savedContactInfo) {
      try {
        const parsed = JSON.parse(savedContactInfo);
        // Backfill website for users who saved contact info before the field existed
        if (!parsed.website) parsed.website = 'https://managerpetrolpump.vercel.app/';
        setContactInfo(parsed);
      } catch (e) {
        console.warn('Corrupt contact info in localStorage, using defaults:', e);
      }
    }
  }, []);

  // Save contact info to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem('mpump_contact_info', JSON.stringify(contactInfo));
  }, [contactInfo]);

  // Cloud sync removed - local backup only

  // Google Drive functions removed

  // Online URL state
  const [onlineUrl, setOnlineUrl] = useState('');

  const [savedOnlineUrl, setSavedOnlineUrl] = useState('');

  // Load online URL from localStorage
  React.useEffect(() => {
    const savedUrl = localStorage.getItem('mpump_online_url');
    if (savedUrl) {
      setSavedOnlineUrl(savedUrl);
      setOnlineUrl(savedUrl);
    }
  }, []);

  // Weekly auto-backup state
  const [weeklyBackupEnabled, setWeeklyBackupEnabled] = useState(false);
  const [weeklyLastBackup, setWeeklyLastBackup] = useState(null);
  const [ownerEmail, setOwnerEmail] = useState(() => localStorage.getItem('mpump_backup_email') || '');
  const [weeklyNextScheduled, setWeeklyNextScheduled] = useState(null);

  // Load weekly auto-backup settings
  React.useEffect(() => {
    const status = getBackupStatus();
    setWeeklyBackupEnabled(status.enabled);
    setWeeklyLastBackup(status.lastBackupTime);
    setWeeklyNextScheduled(status.nextScheduledTime);
  }, [getBackupStatus]);

  // Auto-backup folder state
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [backupFolderName, setBackupFolderName] = useState('');
  const [lastBackupTime, setLastBackupTime] = useState(null);

  // Load auto-backup settings from localStorage
  React.useEffect(() => {
    const settings = localStorage.getItem('mpump_auto_backup_settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      setAutoBackupEnabled(parsed.enabled || false);
      setBackupFolderName(parsed.folderName || '');
      setLastBackupTime(parsed.lastBackupTime || null);
    }
  }, []);

  // Android import callback removed - using standard file input for all platforms

  const updateNozzleCount = (fuelType, delta) => {
    if (!fuelSettings || !fuelSettings[fuelType]) return;
    
    const newSettings = {
      ...fuelSettings,
      [fuelType]: {
        ...fuelSettings[fuelType],
        nozzleCount: Math.max(1, Math.min(10, fuelSettings[fuelType].nozzleCount + delta))
      }
    };
    
    setFuelSettings(newSettings);
    localStorageService.setFuelSettings(newSettings);
  };

  const addFuelType = () => {
    if (!newFuelType.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please enter a fuel type name",
        variant: "destructive",
      });
      return;
    }

    if (fuelSettings && fuelSettings[newFuelType]) {
      toast({
        title: "Duplicate Fuel Type",
        description: "This fuel type already exists",
        variant: "destructive",
      });
      return;
    }

    // Use a default price of 100 when adding new fuel type
    // Price will be set in the Price Configuration tab
    const newSettings = {
      ...(fuelSettings || {}),
      [newFuelType]: {
        price: 100.00, // Default price, will be configured in Price tab
        nozzleCount: 2
      }
    };
    
    setFuelSettings(newSettings);
    localStorageService.setFuelSettings(newSettings);
    setNewFuelType('');
    
    toast({
      title: "Fuel Type Added",
      description: `${newFuelType} has been added successfully. Set the rate in the Rate tab.`,
    });
  };

  const removeFuelType = (fuelType) => {
    if (!fuelSettings) return;
    
    const { [fuelType]: removed, ...newSettings } = fuelSettings;
    
    setFuelSettings(newSettings);
    localStorageService.setFuelSettings(newSettings);
    
    toast({
      title: "Fuel Type Removed",
      description: `${fuelType} has been removed successfully`,
    });
  };

  const resetToDefaults = () => {
    const defaultSettings = {
      'Petrol': { price: 102.50, nozzleCount: 3 },
      'Diesel': { price: 89.75, nozzleCount: 2 },
      'CNG': { price: 75.20, nozzleCount: 2 },
      'Premium': { price: 108.90, nozzleCount: 1 }
    };
    setFuelSettings(defaultSettings);
    
    toast({
      title: "Settings Reset",
      description: "Fuel settings have been reset to defaults",
    });
  };

  // Employee management functions removed

  // Owner details functions removed

  // Employee form handlers removed

  const handleNewFuelTypeChange = useCallback((e) => {
    setNewFuelType(e.target.value);
  }, []);

  // Setup auto-backup folder
  const setupAutoBackupFolder = async () => {
    try {
      // Check if File System Access API is supported
      if (!('showDirectoryPicker' in window)) {
        toast({
          title: "Not Supported",
          description: "Auto-backup requires Chrome/Edge browser version 86+",
          variant: "destructive",
        });
        return;
      }

      // Ask user to select a folder
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents'
      });

      // Test write permission
      await dirHandle.requestPermission({ mode: 'readwrite' });

      // Save folder handle (note: can't directly serialize handle)
      // We'll store folder name and request permission each time
      const folderName = dirHandle.name;
      
      // Store settings
      const settings = {
        enabled: true,
        folderName: folderName,
        lastBackupTime: new Date().toISOString()
      };
      
      localStorage.setItem('mpump_auto_backup_settings', JSON.stringify(settings));
      localStorage.setItem('mpump_backup_folder_handle', 'granted'); // Flag to indicate permission was granted
      
      // Store the handle in a way we can retrieve it (IndexedDB)
      const db = await openBackupDB();
      await db.put('folderHandles', dirHandle, 'autoBackupFolder');
      
      setAutoBackupEnabled(true);
      setBackupFolderName(folderName);
      
      // Perform initial backup
      await performAutoBackup(dirHandle);
      
      toast({
        title: "Auto-Backup Enabled",
        description: `Backups will be saved to: ${folderName}`,
      });

    } catch (error) {
      if (error.name === 'AbortError') {
        toast({
          title: "Cancelled",
          description: "Folder selection was cancelled",
        });
      } else {
        console.error('Auto-backup setup error:', error);
        toast({
          title: "Setup Failed",
          description: "Could not setup auto-backup folder. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  // Disable auto-backup
  const disableAutoBackup = () => {
    localStorage.removeItem('mpump_auto_backup_settings');
    localStorage.removeItem('mpump_backup_folder_handle');
    setAutoBackupEnabled(false);
    setBackupFolderName('');
    setLastBackupTime(null);
    
    toast({
      title: "Auto-Backup Disabled",
      description: "Automatic backups have been turned off",
    });
  };

  // Perform auto backup
  const performAutoBackup = async (dirHandle) => {
    try {
      const backupData = localStorageService.exportAllData();
      const dataStr = JSON.stringify(backupData, null, 2);
      const fileName = `mpump-backup-${new Date().toISOString().split('T')[0]}.json`;
      
      // Create/overwrite file in the selected folder
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(dataStr);
      await writable.close();
      
      const now = new Date().toISOString();
      setLastBackupTime(now);
      
      // Update settings
      const settings = JSON.parse(localStorage.getItem('mpump_auto_backup_settings') || '{}');
      settings.lastBackupTime = now;
      localStorage.setItem('mpump_auto_backup_settings', JSON.stringify(settings));
      
      return true;
    } catch (error) {
      console.error('Auto-backup failed:', error);
      return false;
    }
  };

  // Manual backup to selected folder
  const manualBackupToFolder = async () => {
    try {
      // Get stored folder handle from IndexedDB
      const db = await openBackupDB();
      const dirHandle = await db.get('folderHandles', 'autoBackupFolder');
      
      if (!dirHandle) {
        toast({
          title: "No Folder Selected",
          description: "Please setup auto-backup folder first",
          variant: "destructive",
        });
        return;
      }

      // Request permission again (in case it was revoked)
      const permission = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        toast({
          title: "Permission Denied",
          description: "Please grant folder access permission",
          variant: "destructive",
        });
        return;
      }

      const success = await performAutoBackup(dirHandle);
      
      if (success) {
        toast({
          title: "Backup Successful",
          description: `Saved to: ${backupFolderName}`,
        });
      } else {
        toast({
          title: "Backup Failed",
          description: "Could not save backup file",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Manual backup error:', error);
      toast({
        title: "Backup Failed",
        description: "Could not access backup folder. Please setup again.",
        variant: "destructive",
      });
    }
  };

  // Helper function to open IndexedDB for storing folder handles
  const openBackupDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('MPumpBackupDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('folderHandles')) {
          db.createObjectStore('folderHandles');
        }
      };
    });
  };

  // saveOwnerDetails function removed

  // Contact information functions
  const updateContactInfo = (field, value) => {
    setContactInfo(prev => ({ ...prev, [field]: value }));
  };

  const saveContactInfo = () => {
    toast({
      title: "Contact Information Saved",
      description: "Contact information has been updated successfully",
    });
  };

  // Owner Details component removed

  // Fuel Types component removed - now inline

  // Employees component removed

  // Contact component removed - now inline

  // No separate views needed - everything in dropdown

  // Settings dialog
  return (
    <>
      {!hideTrigger && (
        <Button
          variant="outline"
          className="flex items-center gap-2"
          onClick={() => setSettingsOpen(true)}
        >
          <SettingsIcon className="w-4 h-4" />
          Settings
        </Button>
      )}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent 
          className={`w-[calc(100%-1.5rem)] sm:w-[94%] max-w-5xl h-[calc(100%-1.5rem)] sm:h-[88vh] max-h-[820px] p-0 gap-0 border border-slate-200 dark:border-gray-800 ${
            isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-slate-800'
          } rounded-xl shadow-2xl flex flex-col [&>button]:hidden`}
        >
          <div className="flex flex-col h-full">
            {/* Header with X button */}
            <div className={`flex items-center justify-between px-6 ${
              isDarkMode ? 'bg-gray-800 border-b border-gray-700' : 'bg-gradient-to-r from-gray-600 to-gray-700 border-b border-gray-300'
            }`}
            style={{ height: '48px' }}
            >
              <div className="flex items-center gap-2">
                <SettingsIcon className={`w-5 h-5 ${isDarkMode ? 'text-white' : 'text-white'}`} />
                <DialogTitle className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-white'}`}>
                  Settings
                </DialogTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${isDarkMode ? 'text-white hover:bg-gray-700' : 'text-white hover:bg-gray-600'}`}
                onClick={() => setSettingsOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Tabs Content */}
            <div className="flex-1 overflow-hidden">
              <Tabs defaultValue={defaultTab} className="w-full h-full flex flex-col">
                <TabsList 
                  className={`grid w-full grid-cols-5 ${
                    isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                  }`}
                  style={{ height: '48px', gap: '4px', padding: '4px' }}
                >
                  <TabsTrigger value="customer" className="flex items-center gap-1 text-xs sm:text-sm px-2">
                    <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Customer</span>
                    <span className="sm:hidden">Cust</span>
                  </TabsTrigger>
                  <TabsTrigger value="settlement" className="flex items-center gap-1 text-xs sm:text-sm px-2">
                    <ArrowRightLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Settlement</span>
                    <span className="sm:hidden">Sett</span>
                  </TabsTrigger>
                  <TabsTrigger value="fuel" className="flex items-center gap-1 text-xs sm:text-sm px-2">
                    <Fuel className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Fuel Types</span>
                    <span className="sm:hidden">Fuel</span>
                  </TabsTrigger>
                  <TabsTrigger value="backup" className="flex items-center gap-1 text-xs sm:text-sm px-2">
                    <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Backup</span>
                    <span className="sm:hidden">Bkup</span>
                  </TabsTrigger>
                  <TabsTrigger value="contact" className="flex items-center gap-1 text-xs sm:text-sm px-2">
                    <User className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Contact</span>
                    <span className="sm:hidden">Info</span>
                  </TabsTrigger>
                </TabsList>
              
              <TabsContent value="customer" className="flex-1 min-h-0 p-4 overflow-y-auto">
                <CustomerManagement
                  customers={customers}
                  onAddCustomer={onAddCustomer}
                  onDeleteCustomer={onDeleteCustomer}
                  onUpdateCustomer={onUpdateCustomer}
                  isDarkMode={isDarkMode}
                />
              </TabsContent>
              
              <TabsContent value="settlement" className="flex-1 min-h-0 p-4 overflow-y-auto">
                <SettlementManagement
                  settlementTypes={settlementTypes}
                  onAddSettlementType={handleAddSettlementType}
                  onDeleteSettlementType={handleDeleteSettlementType}
                  onUpdateSettlementType={handleUpdateSettlementType}
                  isDarkMode={isDarkMode}
                />
              </TabsContent>
              
              <TabsContent value="contact" className="flex-1 min-h-0 p-0 overflow-y-auto">
                <div className="px-4 py-4 space-y-4 pb-20">
                  
                  {/* Contact Information Display */}
                  <div className="text-center mb-4">
                    <div className="flex items-center justify-center w-16 h-16 mx-auto mb-3 bg-blue-100 rounded-full">
                      <Phone className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className={`text-lg font-semibold ${
                      isDarkMode ? 'text-white' : 'text-slate-800'
                    }`}>
                      Contact Information
                    </h3>
                  </div>
                  
                  <div className={`border rounded-lg p-4 ${
                    isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <User className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <div className={`text-xs font-medium ${
                            isDarkMode ? 'text-gray-400' : 'text-slate-600'
                          }`}>
                            Owner
                          </div>
                          <div className={`font-medium ${
                            isDarkMode ? 'text-white' : 'text-slate-800'
                          }`}>
                            {contactInfo.dealerName}
                          </div>
                          <div className={`text-sm ${
                            isDarkMode ? 'text-gray-300' : 'text-slate-600'
                          }`}>
                            {contactInfo.pumpName}
                          </div>
                        </div>
                      </div>
                      
                      <Separator className={isDarkMode ? 'bg-gray-600' : 'bg-slate-200'} />
                      
                      <div className="flex items-start gap-3">
                        <Mail className="w-5 h-5 text-red-600 mt-0.5" />
                        <div>
                          <div className={`text-xs font-medium ${
                            isDarkMode ? 'text-gray-400' : 'text-slate-600'
                          }`}>
                            Email
                          </div>
                          <div className={`font-medium break-all ${
                            isDarkMode ? 'text-white' : 'text-slate-800'
                          }`}>
                            {contactInfo.email}
                          </div>
                        </div>
                      </div>

                      <Separator className={isDarkMode ? 'bg-gray-600' : 'bg-slate-200'} />

                      <div className="flex items-start gap-3">
                        <Globe className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                          <div className={`text-xs font-medium ${
                            isDarkMode ? 'text-gray-400' : 'text-slate-600'
                          }`}>
                            Website
                          </div>
                          <a
                            href={contactInfo.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid="contact-website-link"
                            className={`font-medium break-all underline ${
                              isDarkMode ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-700'
                            }`}
                          >
                            {contactInfo.website}
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Online Access Section (moved from Online tab) */}
                  <Separator className={isDarkMode ? 'bg-gray-600' : 'bg-slate-200'} />
                  
                  <div className="text-center mb-4">
                    <div className="flex items-center justify-center w-16 h-16 mx-auto mb-3 bg-green-100 rounded-full">
                      <Globe className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className={`text-lg font-semibold ${
                      isDarkMode ? 'text-white' : 'text-slate-800'
                    }`}>
                      Online Access
                    </h3>
                    <p className={`text-sm mt-2 ${
                      isDarkMode ? 'text-gray-400' : 'text-slate-600'
                    }`}>
                      Save your webpage URL to access the app online
                    </p>
                  </div>
                  
                  {/* URL Input Section */}
                  <div className={`border rounded-lg p-4 ${
                    isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Webpage URL</Label>
                      <Input
                        type="url"
                        value={onlineUrl}
                        onChange={(e) => setOnlineUrl(e.target.value)}
                        placeholder="https://managerpetrolpump.vercel.app/"
                        className={isDarkMode ? 'bg-gray-600 border-gray-500' : ''}
                      />
                      <Button 
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          if (!onlineUrl.trim()) {
                            toast({
                              title: "Invalid URL",
                              description: "Please enter a valid URL",
                              variant: "destructive"
                            });
                            return;
                          }

                          localStorage.setItem('mpump_online_url', onlineUrl);
                          setSavedOnlineUrl(onlineUrl);

                          toast({
                            title: "URL Saved",
                            description: "Your online URL has been saved successfully"
                          });
                        }}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save URL
                      </Button>
                      
                      {/* Default Vercel URL */}
                      <div className={`mt-3 p-3 rounded-lg border ${
                        isDarkMode ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'
                      }`}>
                        <p className={`text-xs font-medium mb-1 ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>
                          Default URL:
                        </p>
                        <a
                          href="https://managerpetrolpump.vercel.app/"
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="default-online-url-link"
                          className={`text-sm underline break-all ${isDarkMode ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-700'}`}
                        >
                          https://managerpetrolpump.vercel.app/
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Saved URL Display */}
                  {savedOnlineUrl && (
                    <>
                      <Separator className={isDarkMode ? 'bg-gray-600' : 'bg-slate-200'} />
                      
                      <div className={`border rounded-lg p-4 ${
                        isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-slate-200 bg-slate-50'
                      }`}>
                        <div className="space-y-3">
                          <Label className="text-sm font-medium">Saved URL</Label>
                          <div 
                            className={`p-3 rounded border cursor-pointer transition-colors ${
                              isDarkMode 
                                ? 'bg-gray-600 border-gray-500 hover:bg-gray-500' 
                                : 'bg-white border-slate-300 hover:bg-slate-50'
                            }`}
                            onClick={() => {
                              navigator.clipboard.writeText(savedOnlineUrl).then(() => {
                                toast({
                                  title: "URL Copied",
                                  description: "URL copied to clipboard successfully"
                                });
                              }).catch(() => {
                                // Fallback for older browsers
                                const textArea = document.createElement('textarea');
                                textArea.value = savedOnlineUrl;
                                textArea.style.position = 'fixed';
                                textArea.style.left = '-999999px';
                                document.body.appendChild(textArea);
                                textArea.select();
                                
                                try {
                                  document.execCommand('copy');
                                  toast({
                                    title: "URL Copied",
                                    description: "URL copied to clipboard successfully"
                                  });
                                } catch (err) {
                                  toast({
                                    title: "Copy Failed",
                                    description: "Could not copy URL. Please enable clipboard permissions.",
                                    variant: "destructive"
                                  });
                                }
                                
                                document.body.removeChild(textArea);
                              });
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-sm break-all ${
                                isDarkMode ? 'text-blue-300' : 'text-blue-600'
                              }`}>
                                {savedOnlineUrl}
                              </span>
                              <span className={`text-xs ml-2 whitespace-nowrap ${
                                isDarkMode ? 'text-gray-400' : 'text-slate-500'
                              }`}>
                                Click to copy
                              </span>
                            </div>
                          </div>
                          <p className={`text-xs ${
                            isDarkMode ? 'text-gray-500' : 'text-slate-500'
                          }`}>
                            💡 Click on the URL above to copy it to clipboard
                          </p>
                          
                          <Button
                            variant="outline"
                            data-testid="delete-saved-url-btn"
                            className="w-full mt-3 bg-red-600 hover:bg-red-700 text-white border-red-600"
                            onClick={() => {
                              // Delete directly — window.confirm is blocked in Android WebView
                              // so using it would cause this button to silently do nothing.
                              localStorage.removeItem('mpump_online_url');
                              setSavedOnlineUrl('');
                              setOnlineUrl('');
                              toast({
                                title: "URL Deleted",
                                description: "Saved URL has been removed successfully"
                              });
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Saved URL
                          </Button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Delete Data Section - Pro Mode Only */}
                  {proMode && (
                    <>
                      <Separator className={isDarkMode ? 'bg-gray-600' : 'bg-slate-200'} />
                      
                      <div className={`border rounded-lg p-4 ${
                        isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-slate-200 bg-slate-50'
                      }`}>
                        <div className="space-y-3">
                          <h4 className={`font-medium ${
                            isDarkMode ? 'text-white' : 'text-slate-800'
                          }`}>
                            Delete Data
                          </h4>
                          
                          {/* Date Range Row */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label className="text-xs font-medium">From Date</Label>
                              <Input
                                type="date"
                                id="delete-from-date"
                                className={`text-sm ${isDarkMode ? 'bg-gray-600 border-gray-500' : ''}`}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-medium">To Date</Label>
                              <Input
                                type="date"
                                id="delete-to-date"
                                className={`text-sm ${isDarkMode ? 'bg-gray-600 border-gray-500' : ''}`}
                              />
                            </div>
                          </div>
                          
                          {/* Permanent Delete Button (with inline confirmation) */}
                          {!rangeDeleteConfirm.open ? (
                            <Button 
                              variant="outline" 
                              data-testid="settings-range-delete-btn"
                              className="w-full bg-red-600 hover:bg-red-700 text-white border-red-600"
                              onClick={() => {
                                const fromDateInput = document.getElementById('delete-from-date');
                                const toDateInput = document.getElementById('delete-to-date');
                                const fromDate = fromDateInput?.value;
                                const toDate = toDateInput?.value;

                                if (!fromDate || !toDate) {
                                  toast({
                                    title: "Invalid Date Range",
                                    description: "Please select both from and to dates",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                if (fromDate > toDate) {
                                  toast({
                                    title: "Invalid Date Range",
                                    description: "From date cannot be after To date",
                                    variant: "destructive",
                                  });
                                  return;
                                }

                                if (proMode) {
                                  // Pro mode: skip confirmation entirely
                                  performRangeDelete(fromDate, toDate);
                                } else {
                                  // Inline confirmation prompt
                                  setRangeDeleteConfirm({ open: true, fromDate, toDate });
                                }
                              }}
                            >
                              Permanent Delete
                            </Button>
                          ) : (
                            <div className={`p-3 rounded border-2 space-y-2 ${
                              isDarkMode ? 'border-red-600 bg-red-900/20' : 'border-red-500 bg-red-50'
                            }`}>
                              <p className={`text-xs font-medium ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}>
                                Permanently delete data from <strong>{rangeDeleteConfirm.fromDate}</strong> to <strong>{rangeDeleteConfirm.toDate}</strong>?
                                This cannot be undone.
                              </p>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="flex-1 bg-red-600 hover:bg-red-700"
                                  data-testid="settings-range-delete-confirm"
                                  onClick={() => {
                                    performRangeDelete(rangeDeleteConfirm.fromDate, rangeDeleteConfirm.toDate);
                                    setRangeDeleteConfirm({ open: false, fromDate: '', toDate: '' });
                                  }}
                                >
                                  Yes, Delete
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  data-testid="settings-range-delete-cancel"
                                  onClick={() => setRangeDeleteConfirm({ open: false, fromDate: '', toDate: '' })}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Pro Mode Section */}
                  <Separator className={isDarkMode ? 'bg-gray-600' : 'bg-slate-200'} />
                  
                  <div className={`border rounded-lg p-4 ${
                    isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <div className="space-y-3">
                      <h4 className={`font-medium ${
                        isDarkMode ? 'text-white' : 'text-slate-800'
                      }`}>
                        Pro Mode
                      </h4>
                      <p className={`text-xs ${
                        isDarkMode ? 'text-gray-400' : 'text-slate-600'
                      }`}>
                        Enable Pro mode to skip "Are you sure?" confirmation dialogs
                      </p>
                      
                      <div className="flex items-center space-x-3 pt-2">
                        <Checkbox
                          id="pro-mode"
                          checked={proMode}
                          onCheckedChange={handleProModeToggle}
                          className={isDarkMode ? 'border-gray-500' : ''}
                        />
                        <Label
                          htmlFor="pro-mode"
                          className={`text-sm font-medium cursor-pointer ${
                            isDarkMode ? 'text-white' : 'text-slate-700'
                          }`}
                        >
                          {proMode ? '✅ Pro Mode Active' : 'Enable Pro Mode'}
                        </Label>
                      </div>
                      
                      {proMode && (
                        <div className={`mt-3 p-3 rounded-lg border ${
                          isDarkMode ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'
                        }`}>
                          <p className={`text-xs ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>
                            ⚡ Pro Mode is active. Delete confirmations are disabled.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Clear All Data Section - Pro Mode Only */}
                  {proMode && (
                    <>
                      <Separator className={isDarkMode ? 'bg-gray-600' : 'bg-slate-200'} />
                      
                      <div className={`border-2 rounded-lg p-4 ${
                        isDarkMode ? 'border-red-600 bg-red-900/20' : 'border-red-500 bg-red-50'
                      }`}>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Trash2 className="w-5 h-5 text-red-600" />
                            <h4 className={`font-bold ${
                              isDarkMode ? 'text-red-400' : 'text-red-700'
                            }`}>
                              ⚠️ Danger Zone
                            </h4>
                          </div>
                          
                          <p className={`text-sm ${
                            isDarkMode ? 'text-red-300' : 'text-red-700'
                          }`}>
                            <strong>Pro Mode Only:</strong> Permanently delete all data from this account.
                          </p>
                          
                          <div className={`text-xs space-y-1 ${
                            isDarkMode ? 'text-red-200' : 'text-red-600'
                          }`}>
                            <p>This will delete:</p>
                            <ul className="list-disc list-inside pl-2">
                              <li>All sales, credit sales, payments</li>
                              <li>All customers and settlements</li>
                              <li>All income and expenses</li>
                              <li>All fuel settings and categories</li>
                              <li>Data from localStorage</li>
                            </ul>
                          </div>

                          <div className={`p-3 rounded ${
                            isDarkMode ? 'bg-red-800/30' : 'bg-red-100'
                          }`}>
                            <p className={`text-xs font-bold ${
                              isDarkMode ? 'text-red-300' : 'text-red-700'
                            }`}>
                              ⚠️ This action CANNOT be undone!
                            </p>
                          </div>
                          
                          <Button 
                            variant="destructive"
                            data-testid="settings-clear-all-btn"
                            className="w-full bg-red-600 hover:bg-red-700"
                            onClick={() => {
                              if (proMode) {
                                // Pro mode: skip confirmation entirely
                                handleClearAllData();
                              } else {
                                setClearAllConfirm({ open: true, typed: '' });
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Clear All Data
                          </Button>
                          {clearAllConfirm.open && (
                            <div className={`mt-2 p-3 rounded border-2 space-y-2 ${
                              isDarkMode ? 'border-red-600 bg-red-900/30' : 'border-red-500 bg-red-100'
                            }`}>
                              <p className={`text-xs font-medium ${isDarkMode ? 'text-red-300' : 'text-red-800'}`}>
                                Type <strong>DELETE ALL</strong> to confirm:
                              </p>
                              <Input
                                type="text"
                                value={clearAllConfirm.typed}
                                onChange={(e) => setClearAllConfirm(prev => ({ ...prev, typed: e.target.value }))}
                                placeholder="DELETE ALL"
                                data-testid="settings-clear-all-input"
                                className={isDarkMode ? 'bg-gray-700 border-gray-500 text-white' : ''}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50"
                                  data-testid="settings-clear-all-confirm"
                                  disabled={clearAllConfirm.typed.trim() !== 'DELETE ALL'}
                                  onClick={() => {
                                    setClearAllConfirm({ open: false, typed: '' });
                                    handleClearAllData();
                                  }}
                                >
                                  Yes, Delete All
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  data-testid="settings-clear-all-cancel"
                                  onClick={() => setClearAllConfirm({ open: false, typed: '' })}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                </div>
              </TabsContent>
              
              <TabsContent value="fuel" className="flex-1 min-h-0 p-4 overflow-y-auto">
                {/* Add New Fuel Type */}
                <div className="space-y-3 mb-4">
                  <Label className="text-sm font-medium">Add New Fuel Type</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newFuelType}
                      onChange={handleNewFuelTypeChange}
                      placeholder="Enter fuel type name"
                      className="flex-1"
                      autoComplete="off"
                      inputMode="text"
                    />
                    <Button onClick={addFuelType} size="sm">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Existing Fuel Types */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Configure Fuel Types</Label>
                  {fuelSettings && Object.entries(fuelSettings).map(([fuelType, config]) => (
                    <div key={fuelType} className={`border rounded-lg p-3 ${
                      isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-slate-200 bg-slate-50'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <Badge className="bg-blue-100 text-blue-800 border-0">
                          {fuelType}
                        </Badge>
                        {fuelType.toUpperCase() !== 'MPP' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFuelType(fuelType)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">Nozzles:</span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateNozzleCount(fuelType, -1)}
                              disabled={config.nozzleCount <= 1}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="font-medium w-8 text-center">
                              {config.nozzleCount}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateNozzleCount(fuelType, 1)}
                              disabled={config.nozzleCount >= 10}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />

                {/* Reset Button */}
                <Button
                  variant="outline"
                  onClick={resetToDefaults}
                  className="w-full flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset to Defaults
                </Button>
              </TabsContent>
              
              <TabsContent value="backup" className="flex-1 min-h-0 p-4 overflow-y-auto">
                <div className="space-y-4">
                  {/* Manual Backup Section */}
                  <Separator className={isDarkMode ? 'bg-gray-600' : 'bg-slate-200'} />
                  
                  <div className={`border rounded-lg p-4 ${
                    isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <div className="space-y-3">
                      <h4 className={`font-medium ${
                        isDarkMode ? 'text-white' : 'text-slate-800'
                      }`}>
                        Manual Backup
                      </h4>
                      
                      <p className={`text-sm ${
                        isDarkMode ? 'text-gray-400' : 'text-slate-600'
                      }`}>
                        Export data manually or copy to clipboard
                      </p>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="outline" 
                          className="w-full"
                          data-testid="settings-export-data-btn"
                          onClick={async () => {
                            try {
                              const backupData = localStorageService.exportAllData();
                              const dataStr = JSON.stringify(backupData, null, 2);
                              const fileName = `mpump-backup-${new Date().toISOString().split('T')[0]}.json`;

                              // Android WebView: route through native bridge so file lands in public Downloads
                              if (typeof window.MPumpCalcAndroid !== 'undefined' &&
                                  typeof window.MPumpCalcAndroid.saveFileToDownloads === 'function') {
                                // btoa does not support UTF-8 directly; encode via TextEncoder then to base64
                                const bytes = new TextEncoder().encode(dataStr);
                                let binary = '';
                                for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
                                const base64 = btoa(binary);
                                window.MPumpCalcAndroid.saveFileToDownloads(base64, fileName, 'application/json');
                                toast({
                                  title: "Backup Exported",
                                  description: `Saved to Downloads/MPumpCalc/${fileName}`,
                                });
                                return;
                              }

                              // Browser: classic anchor download
                              const blob = new Blob([dataStr], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = fileName;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              URL.revokeObjectURL(url);

                              toast({
                                title: "Backup Exported",
                                description: `Check your Downloads folder for ${fileName}`,
                              });
                            } catch (error) {
                              console.error('Export error:', error);
                              toast({
                                title: "Export Failed",
                                description: "Could not download backup file. Try 'Copy Backup Data' button instead.",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          Export Data
                        </Button>

                        <Button
                          variant="outline"
                          className="w-full"
                          data-testid="settings-share-data-btn"
                          onClick={async () => {
                            try {
                              const backupData = localStorageService.exportAllData();
                              const dataStr = JSON.stringify(backupData, null, 2);
                              const fileName = `mpump-backup-${new Date().toISOString().split('T')[0]}.json`;

                              // Android WebView: native ACTION_SEND chooser via JS bridge
                              if (typeof window.MPumpCalcAndroid !== 'undefined' &&
                                  typeof window.MPumpCalcAndroid.shareFile === 'function') {
                                const bytes = new TextEncoder().encode(dataStr);
                                let binary = '';
                                for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
                                const base64 = btoa(binary);
                                window.MPumpCalcAndroid.shareFile(base64, fileName, 'application/json');
                                toast({ title: "Opening share sheet…", description: fileName });
                                return;
                              }

                              // Web: try Web Share API; gracefully fall back to download
                              const blob = new Blob([dataStr], { type: 'application/json' });
                              const triggerDownload = (msgTitle = "Backup Downloaded", msgDesc) => {
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = fileName;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(url);
                                toast({ title: msgTitle, description: msgDesc || `Saved ${fileName} — attach it manually to share.` });
                              };

                              let shareSupported = false;
                              try {
                                const fileToShare = new File([blob], fileName, { type: 'application/json' });
                                shareSupported = !!(typeof navigator !== 'undefined' && navigator.share &&
                                  typeof navigator.canShare === 'function' &&
                                  navigator.canShare({ files: [fileToShare] }));
                                if (shareSupported) {
                                  await navigator.share({
                                    files: [fileToShare],
                                    title: fileName,
                                    text: 'M.Pump1 data backup',
                                  });
                                  toast({ title: "Shared", description: fileName });
                                  return;
                                }
                              } catch (err) {
                                // AbortError = user dismissed; NotAllowedError / SecurityError = iframe / permission policy blocked
                                if (err && err.name === 'AbortError') {
                                  toast({ title: "Share cancelled" });
                                  return;
                                }
                                console.warn('Web Share failed, falling back to download:', err);
                              }

                              triggerDownload("Share not supported here",
                                `Saved ${fileName} to Downloads. You can attach it manually from your file manager.`);
                            } catch (error) {
                              console.error('Share error:', error);
                              toast({
                                title: "Share Failed",
                                description: error.message || "Could not share backup file.",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          Share Data
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {/* Financial Year Backup — inline (no modal) */}
                        <div className={`w-full rounded-lg border p-3 space-y-2 ${
                          isDarkMode ? 'border-gray-600 bg-gray-800' : 'border-slate-300 bg-slate-50'
                        }`}>
                          <p className={`text-sm font-medium ${
                            isDarkMode ? 'text-gray-200' : 'text-slate-700'
                          }`}>
                            📅 Backup Financial Year
                          </p>
                          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                            Exports all data from <strong>1 April {fyBackupYear}</strong> to <strong>31 March {fyBackupYear + 1}</strong>.
                          </p>
                          <select
                            data-testid="fy-backup-year-select"
                            value={fyBackupYear}
                            onChange={(e) => setFyBackupYear(parseInt(e.target.value, 10))}
                            className={`w-full rounded-md border px-3 py-2 text-sm ${
                              isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-slate-300'
                            }`}
                          >
                            {(() => {
                              const today = new Date();
                              const currentFy = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
                              // 2 future + current + 7 past = 10 options, newest first
                              const options = [];
                              for (let yr = currentFy + 2; yr >= currentFy - 7; yr--) {
                                let label = `${yr} – ${yr + 1}`;
                                if (yr === currentFy) label += '  (current)';
                                else if (yr > currentFy) label += '  (future)';
                                options.push(<option key={yr} value={yr}>{label}</option>);
                              }
                              return options;
                            })()}
                          </select>
                          <Button
                            data-testid="fy-backup-export-btn"
                            disabled={fyBackupBusy}
                            onClick={() => {
                              if (fyBackupBusy) return;
                              setFyBackupBusy(true);
                              // Yield to React so the "Generating…" state paints
                              // before we synchronously filter + stringify the
                              // payload (~200–700 ms with years of data).
                              setTimeout(() => {
                                try {
                                  const data = localStorageService.exportFinancialYearData(fyBackupYear);
                                  const dataStr = JSON.stringify(data, null, 2);
                                  const fileName = `mpump-FY${fyBackupYear}-${fyBackupYear + 1}.json`;

                                  if (typeof window.MPumpCalcAndroid !== 'undefined' &&
                                      typeof window.MPumpCalcAndroid.saveFileToDownloads === 'function') {
                                    const bytes = new TextEncoder().encode(dataStr);
                                    let binary = '';
                                    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
                                    const base64 = btoa(binary);
                                    window.MPumpCalcAndroid.saveFileToDownloads(base64, fileName, 'application/json');
                                    toast({
                                      title: 'Backup Saved',
                                      description: `Saved to Downloads/MPumpCalc/${fileName}`,
                                    });
                                  } else {
                                    const blob = new Blob([dataStr], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.download = fileName;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    URL.revokeObjectURL(url);
                                    toast({
                                      title: 'Backup Downloaded',
                                      description: fileName,
                                    });
                                  }

                                  console.log('FY Backup:', {
                                    sales: data.salesData.length,
                                    credits: data.creditData.length,
                                    receipts: data.payments.length,
                                  });
                                  refreshStorageInfo();
                                } catch (err) {
                                  console.error('FY backup error:', err);
                                  toast({
                                    title: 'Backup Failed',
                                    description: 'Could not generate financial year backup.',
                                    variant: 'destructive',
                                  });
                                } finally {
                                  setFyBackupBusy(false);
                                }
                              }, 50);
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
                          >
                            {fyBackupBusy ? 'Generating…' : `Backup FY ${fyBackupYear}–${fyBackupYear + 1}`}
                          </Button>
                        </div>
                        
                        {/* Live storage gauge (cached; refreshed when dialog opens) */}
                        {(() => {
                          const info = storageInfo;
                          const usedKB = Math.round(info.totalSize / 1024);
                          const maxKB = Math.round(info.maxSize / 1024);
                          const pct = Math.min(100, Math.round(info.usagePercent));
                          const barColor = pct < 60
                            ? (isDarkMode ? 'bg-gray-300' : 'bg-slate-700')
                            : pct < 85
                              ? (isDarkMode ? 'bg-yellow-400' : 'bg-yellow-500')
                              : (isDarkMode ? 'bg-red-400' : 'bg-red-600');
                          return (
                            <div
                              data-testid="storage-gauge"
                              onClick={refreshStorageInfo}
                              className={`w-full rounded-lg border p-3 cursor-pointer ${
                                isDarkMode ? 'border-gray-600 bg-gray-800' : 'border-slate-300 bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className={`text-sm font-medium ${
                                  isDarkMode ? 'text-gray-200' : 'text-slate-700'
                                }`}>
                                  📊 Storage Usage
                                </span>
                                <span className={`text-xs font-mono ${
                                  isDarkMode ? 'text-gray-300' : 'text-slate-600'
                                }`}>
                                  {usedKB} / {maxKB} KB ({pct}%)
                                </span>
                              </div>
                              <div className={`w-full h-2 rounded-full overflow-hidden ${
                                isDarkMode ? 'bg-gray-700' : 'bg-slate-200'
                              }`}>
                                <div
                                  className={`h-full transition-all ${barColor}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <p className={`text-xs mt-2 ${
                                isDarkMode ? 'text-gray-400' : 'text-slate-500'
                              }`}>
                                {info.itemCount} items stored. {pct >= 85 ? 'Approaching limit — consider archiving older financial years.' : 'Tap to refresh.'}
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Merge Backup Data Section */}
                  <Separator className={isDarkMode ? 'bg-gray-600' : 'bg-slate-200'} />
                  
                  <div className={`border rounded-lg p-4 ${
                    isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <div className="space-y-3">
                      <h4 className={`font-medium ${
                        isDarkMode ? 'text-white' : 'text-slate-800'
                      }`}>
                        Merge Backup Data
                      </h4>
                      
                      <Button 
                        variant="outline" 
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white border-orange-600"
                        onClick={() => {
                          // Create file input and append to DOM (required for mobile browsers)
                          const fileInput = document.createElement('input');
                          fileInput.type = 'file';
                          fileInput.accept = '.json,application/json,.txt,text/plain';
                          fileInput.style.display = 'none';
                          document.body.appendChild(fileInput);
                          
                          fileInput.onchange = (e) => {
                            const file = e.target.files[0];
                            // Remove input from DOM
                            if (fileInput.parentNode) document.body.removeChild(fileInput);
                            if (!file) return;
                            
                            // Check file type - accept json and txt
                            if (!file.name.endsWith('.json') && !file.name.endsWith('.txt')) {
                              toast({
                                title: "Invalid File",
                                description: "Please select a valid JSON backup file",
                                variant: "destructive",
                              });
                              return;
                            }
                            
                            // Read file
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              try {
                                const importedData = JSON.parse(event.target.result);
                                console.log('Merge: Parsed data keys:', Object.keys(importedData));
                                console.log('Merge: salesData count:', importedData.salesData?.length || 0);
                                console.log('Merge: customers count:', importedData.customers?.length || 0);
                                console.log('Merge: settlements count:', importedData.settlements?.length || 0);
                                
                                // Validate data structure - accept if has any valid data
                                const hasData = importedData.salesData || importedData.creditData || 
                                    importedData.incomeData || importedData.expenseData ||
                                    importedData.customers || importedData.payments ||
                                    importedData.settlements || importedData.fuelSettings;
                                
                                console.log('Merge: hasData =', !!hasData);
                                
                                if (!hasData) {
                                  toast({
                                    title: "Invalid Backup File",
                                    description: "The file doesn't contain valid backup data",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                
                                // Proceed with merge directly
                                console.log('Merge: Calling mergeAllData...');
                                const success = localStorageService.mergeAllData(importedData);
                                console.log('Merge: Result =', success);
                                  
                                if (success) {
                                    toast({
                                      title: "Data Merged Successfully",
                                      description: "Backup data has been merged with existing data. Refreshing...",
                                    });
                                    
                                    setTimeout(() => {
                                      window.location.reload();
                                    }, 2000);
                                } else {
                                    toast({
                                      title: "Merge Failed",
                                      description: "Failed to merge data. Please try again.",
                                      variant: "destructive",
                                    });
                                }
                              } catch (error) {
                                toast({
                                  title: "Merge Error",
                                  description: "Failed to read backup file. Please ensure it's a valid JSON file.",
                                  variant: "destructive",
                                });
                                console.error('Merge error:', error);
                              }
                            };
                            
                            reader.readAsText(file);
                          };
                          
                          // Trigger file selection after DOM attachment
                          setTimeout(() => fileInput.click(), 100);
                        }}
                      >
                        🔀 Merge Manual Data
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                        data-testid="merge-pdf-btn"
                        onClick={() => {
                          const fileInput = document.createElement('input');
                          fileInput.type = 'file';
                          fileInput.accept = 'application/pdf,.pdf';
                          fileInput.style.display = 'none';
                          document.body.appendChild(fileInput);

                          fileInput.onchange = async (e) => {
                            const file = e.target.files[0];
                            if (fileInput.parentNode) document.body.removeChild(fileInput);
                            if (!file) return;

                            if (!file.name.toLowerCase().endsWith('.pdf')) {
                              toast({ title: "Invalid File", description: "Please select a PDF generated by this app.", variant: "destructive" });
                              return;
                            }

                            try {
                              const buf = await file.arrayBuffer();
                              // PDF bytes are mostly ASCII; decode with latin1 so no char is lost
                              const text = new TextDecoder('latin1').decode(buf);
                              const m = text.match(/MPUMP_DATA_V1:([A-Za-z0-9+/=\n\r\s]+?):END/);
                              if (!m) {
                                toast({
                                  title: "No Data in PDF",
                                  description: "This PDF has no embedded data. Make sure it was generated by the latest app version (rebuild your APK if needed), then try again.",
                                  variant: "destructive"
                                });
                                return;
                              }
                              const b64 = m[1].replace(/\s+/g, '');
                              const bin = atob(b64);
                              const u8 = new Uint8Array(bin.length);
                              for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
                              const json = new TextDecoder('utf-8').decode(u8);
                              const payload = JSON.parse(json);

                              if (payload.version !== 'MPUMP_PDF_V1') {
                                toast({ title: "Unsupported PDF version", description: "This PDF was created by a different version of the app.", variant: "destructive" });
                                return;
                              }

                              console.log('MergePDF: date=' + payload.date + ', sales=' + (payload.salesData?.length || 0));
                              const ok = localStorageService.mergeAllData(payload);
                              if (ok) {
                                toast({
                                  title: "PDF Data Merged",
                                  description: "Records for " + payload.date + " imported. Refreshing...",
                                });
                                setTimeout(() => window.location.reload(), 2000);
                              } else {
                                toast({ title: "Merge Failed", description: "Could not merge PDF data.", variant: "destructive" });
                              }
                            } catch (err) {
                              console.error('MergePDF error:', err);
                              toast({ title: "Import Error", description: "Failed to read data from this PDF.", variant: "destructive" });
                            }
                          };

                          setTimeout(() => fileInput.click(), 100);
                        }}
                      >
                        Merge PDF
                      </Button>
                    </div>
                  </div>

                  {/* Auto Backup (7 Days) Section */}
                  <Separator className={isDarkMode ? 'bg-gray-600' : 'bg-slate-200'} />
                  
                  <div className={`border rounded-lg p-4 ${
                    isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className={`font-medium ${
                          isDarkMode ? 'text-white' : 'text-slate-800'
                        }`}>
                          Auto Backup (Every 7 Days)
                        </h4>
                        <Badge variant={weeklyBackupEnabled ? "default" : "outline"}>
                          {weeklyBackupEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      
                      <p className={`text-sm ${
                        isDarkMode ? 'text-gray-400' : 'text-slate-600'
                      }`}>
                        Automatically download backup file every 7 days
                      </p>
                      
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="weekly-backup-toggle"
                            checked={weeklyBackupEnabled}
                            onChange={(e) => {
                              const enabled = e.target.checked;
                              setWeeklyBackupEnabled(enabled);
                              toggleAutoBackup(enabled);
                              
                              // Refresh status
                              const status = getBackupStatus();
                              setWeeklyLastBackup(status.lastBackupTime);
                              setWeeklyNextScheduled(status.nextScheduledTime);
                              
                              toast({
                                title: enabled ? "Auto Backup Enabled" : "Auto Backup Disabled",
                                description: enabled 
                                  ? "Backup will be automatically downloaded every 7 days"
                                  : "Auto backup has been turned off"
                              });
                            }}
                            className="w-4 h-4"
                          />
                          <label 
                            htmlFor="weekly-backup-toggle"
                            className={`text-sm cursor-pointer ${
                              isDarkMode ? 'text-gray-300' : 'text-slate-700'
                            }`}
                          >
                            Enable automatic backup every 7 days
                          </label>
                        </div>

                        {/* Backup Now button - always available, regardless of auto-backup toggle */}
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid="backup-now-btn"
                          onClick={() => {
                            const result = backupNow();
                            if (result?.success) {
                              // Refresh the "last backup" display
                              const status = getBackupStatus();
                              setWeeklyLastBackup(status.lastBackupTime);
                            }
                          }}
                          className={`w-full ${
                            isDarkMode
                              ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                              : 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                          }`}
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Backup Now {ownerEmail ? '(Send to Email)' : ''}
                        </Button>

                        {weeklyBackupEnabled && (
                          <div className={`space-y-2 p-3 rounded ${
                            isDarkMode ? 'bg-gray-600' : 'bg-blue-50'
                          }`}>
                            <div className={`text-xs ${
                              isDarkMode ? 'text-gray-300' : 'text-slate-700'
                            }`}>
                              <strong>Last Auto Backup:</strong>{' '}
                              {weeklyLastBackup 
                                ? new Date(weeklyLastBackup).toLocaleString()
                                : 'Not yet performed'}
                            </div>
                            <div className={`text-xs ${
                              isDarkMode ? 'text-gray-300' : 'text-slate-700'
                            }`}>
                              <strong>Next Scheduled:</strong>{' '}
                              {weeklyNextScheduled 
                                ? new Date(weeklyNextScheduled).toLocaleString()
                                : 'Not scheduled'}
                            </div>

                            <div className="pt-2 space-y-1">
                              <label
                                htmlFor="owner-email-input"
                                className={`text-xs font-medium ${isDarkMode ? 'text-gray-200' : 'text-slate-700'}`}
                              >
                                Send backup to email (optional)
                              </label>
                              <input
                                id="owner-email-input"
                                data-testid="owner-email-input"
                                type="email"
                                placeholder="owner@gmail.com"
                                value={ownerEmail}
                                onChange={(e) => {
                                  setOwnerEmail(e.target.value);
                                  localStorage.setItem('mpump_backup_email', e.target.value);
                                }}
                                className={`w-full text-sm px-2 py-1 rounded border ${
                                  isDarkMode
                                    ? 'bg-gray-700 border-gray-500 text-white placeholder-gray-400'
                                    : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
                                }`}
                              />
                              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                                Gmail will open pre-filled with the backup attached. Tap Send to deliver.
                              </p>
                            </div>
                          </div>
                        )}

                        <p className={`text-xs ${
                          isDarkMode ? 'text-gray-500' : 'text-slate-500'
                        }`}>
                          💡 Note: Backup file will download automatically when you open the app after 7 days
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              
              {/* Cloud Sync Tab removed - local backup only */}
              
            </Tabs>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pro Mode Password Dialog */}
      <Dialog open={showProPasswordDialog} onOpenChange={setShowProPasswordDialog}>
        <DialogContent className={`sm:max-w-md ${isDarkMode ? 'bg-gray-800 text-white' : ''}`}>
          <div className="space-y-4">
            <div className="text-center">
              <DialogTitle className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                Enable Pro Mode
              </DialogTitle>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                Enter password to enable Pro mode
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="pro-password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                id="pro-password"
                type="password"
                value={proPassword}
                onChange={(e) => setProPassword(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleProPasswordSubmit();
                  }
                }}
                placeholder="Enter password"
                className={isDarkMode ? 'bg-gray-700 border-gray-600' : ''}
                autoFocus
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowProPasswordDialog(false);
                  setProPassword('');
                }}
                className={isDarkMode ? 'border-gray-600' : ''}
              >
                Cancel
              </Button>
              <Button
                onClick={handleProPasswordSubmit}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Enable Pro Mode
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </>
  );
};

export default HeaderSettings;