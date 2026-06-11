import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  collection,
  getDocFromServer,
  writeBatch
} from 'firebase/firestore';
import localStorageService from './localStorage';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Error handler required by guidelines
export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test Connection on load
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firebase client is offline. Synchronization will resume when online.");
    }
  }
}
testConnection();

// Core Cloud Synchronization Sync Class
class FirebaseSyncService {
  constructor() {
    this.syncing = false;
    this.listeners = new Set();
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach(l => l());
  }

  async signIn() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      console.error('Google Sign In failed:', error);
      throw error;
    }
  }

  async logout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Google Sign Out failed:', error);
      throw error;
    }
  }

  // Helper: Write item to firestore with nested structure `/users/{userId}/{collectionName}/{docId}`
  async saveToCloud(collectionName, docId, data) {
    const user = auth.currentUser;
    if (!user) return;
    const path = `users/${user.uid}/${collectionName}`;
    try {
      const docRef = doc(db, path, docId);
      await setDoc(docRef, { ...data, userId: user.uid });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${path}/${docId}`);
    }
  }

  // Helper: Delete item from firestore
  async deleteFromCloud(collectionName, docId) {
    const user = auth.currentUser;
    if (!user) return;
    const path = `users/${user.uid}/${collectionName}`;
    try {
      const docRef = doc(db, path, docId);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${path}/${docId}`);
    }
  }

  // Helper: Get direct list from Firestore with check
  async getCollectionFromCloud(collectionName) {
    const user = auth.currentUser;
    if (!user) return [];
    const path = `users/${user.uid}/${collectionName}`;
    try {
      const querySnapshot = await getDocs(collection(db, path));
      const items = [];
      querySnapshot.forEach((doc) => {
        items.push(doc.data());
      });
      return items;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  // Download all cloud data into active local storage (merging)
  async pullFromCloud() {
    const user = auth.currentUser;
    if (!user) return;
    this.syncing = true;
    this.notify();

    try {
      console.log('🔄 Pulling data from Firestore cloud...');
      
      const sales = await this.getCollectionFromCloud('sales');
      const credits = await this.getCollectionFromCloud('credits');
      const payments = await this.getCollectionFromCloud('payments');
      const settlements = await this.getCollectionFromCloud('settlements');
      const income = await this.getCollectionFromCloud('income');
      const expense = await this.getCollectionFromCloud('expense');
      const customers = await this.getCollectionFromCloud('customers');
      const settlementTypes = await this.getCollectionFromCloud('settlementTypes');
      const incomeCategories = await this.getCollectionFromCloud('incomeCategories');
      const expenseCategories = await this.getCollectionFromCloud('expenseCategories');

      // Fetch metadata documents
      const pathFuel = `users/${user.uid}/settings/fuelSettings`;
      const pathRates = `users/${user.uid}/settings/rates`;
      const pathStock = `users/${user.uid}/settings/stock`;
      
      let fuelSettings = null;
      let rates = null;
      let stockData = {};

      try {
        const fuelSnap = await getDoc(doc(db, pathFuel));
        if (fuelSnap.exists()) fuelSettings = fuelSnap.data().data;
      } catch (e) { console.error('Failed to get fuelSettings:', e); }

      try {
        const ratesSnap = await getDoc(doc(db, pathRates));
        if (ratesSnap.exists()) rates = ratesSnap.data().data;
      } catch (e) { console.error('Failed to get rates:', e); }

      try {
        const stockSnap = await getDoc(doc(db, pathStock));
        if (stockSnap.exists()) stockData = stockSnap.data().data;
      } catch (e) { console.error('Failed to get stock:', e); }

      // Construct imported document package
      const cloudData = {
        salesData: sales,
        creditData: credits,
        payments: payments,
        settlements: settlements,
        incomeData: income,
        expenseData: expense,
        customers: customers,
        settlementTypes: settlementTypes,
        incomeCategories: incomeCategories,
        expenseCategories: expenseCategories,
        fuelSettings: fuelSettings || undefined,
        rates: rates || undefined,
        stockData: stockData || undefined,
      };

      // Perform a clean state update by merging or importing
      localStorageService.mergeAllData(cloudData);
      console.log('✅ Pull from Firestore cloud succeeded!');
    } catch (error) {
      console.error('Failed to pull from cloud:', error);
    } finally {
      this.syncing = false;
      this.notify();
    }
  }

  // Push all local namespace datasets to cloud
  async pushToCloud() {
    const user = auth.currentUser;
    if (!user) return;
    this.syncing = true;
    this.notify();

    try {
      console.log('🔄 Pushing local localStorage datasets to Firestore...');
      
      const sales = localStorageService.getSalesData();
      const credits = localStorageService.getCreditData();
      const payments = localStorageService.getPayments();
      const settlements = localStorageService.getSettlements();
      const income = localStorageService.getIncomeData();
      const expense = localStorageService.getExpenseData();
      const customers = localStorageService.getCustomers();
      const settlementTypes = localStorageService.getSettlementTypes();
      const incomeCategories = localStorageService.getIncomeCategories();
      const expenseCategories = localStorageService.getExpenseCategories();
      
      // Sync collections sequentially
      for (const item of sales) {
        await this.saveToCloud('sales', item.id, item);
      }
      for (const item of credits) {
        await this.saveToCloud('credits', item.id, item);
      }
      for (const item of payments) {
        await this.saveToCloud('payments', item.id, item);
      }
      for (const item of settlements) {
        await this.saveToCloud('settlements', item.id, item);
      }
      for (const item of income) {
        await this.saveToCloud('income', item.id, item);
      }
      for (const item of expense) {
        await this.saveToCloud('expense', item.id, item);
      }
      for (const item of customers) {
        await this.saveToCloud('customers', item.id, item);
      }
      for (const item of settlementTypes) {
        await this.saveToCloud('settlementTypes', item.id, item);
      }
      for (const item of incomeCategories) {
        await this.saveToCloud('incomeCategories', item.id, item);
      }
      for (const item of expenseCategories) {
        await this.saveToCloud('expenseCategories', item.id, item);
      }

      // Sync settings
      const fuelSettings = localStorageService.getFuelSettings();
      if (fuelSettings) {
        await this.saveToCloud('settings', 'fuelSettings', { data: fuelSettings });
      }
      const rates = localStorageService.getAllRates();
      if (rates) {
        await this.saveToCloud('settings', 'rates', { data: rates });
      }

      // Sync stock data
      const stockData = {};
      const fuelKeys = Object.keys(fuelSettings || {});
      fuelKeys.forEach(fuelType => {
        const storageKey = `${fuelType.toLowerCase()}StockData`;
        const data = localStorageService.getItem(storageKey);
        if (data) stockData[storageKey] = data;
      });
      if (Object.keys(stockData).length > 0) {
        await this.saveToCloud('settings', 'stock', { data: stockData });
      }

      console.log('✅ Push to cloud complete!');
    } catch (error) {
      console.error('Failed to push to cloud:', error);
    } finally {
      this.syncing = false;
      this.notify();
    }
  }
}

export const syncService = new FirebaseSyncService();

// Connect real-time synchronization callback on localStorageService
localStorageService.onSyncCallback = async (action, collectionName, docId, data) => {
  const user = auth.currentUser;
  if (!user) return; // Only sync to cloud if logged in

  try {
    if (action === 'create' || action === 'update') {
      await syncService.saveToCloud(collectionName, docId, data);
    } else if (action === 'delete') {
      await syncService.deleteFromCloud(collectionName, docId);
    } else if (action === 'update_settings') {
      await syncService.saveToCloud(collectionName, docId, { data });
    }
  } catch (error) {
    console.error(`Automatic real-time background sync failed for ${collectionName}/${docId}:`, error);
  }
};

export default syncService;
