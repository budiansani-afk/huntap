/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Home, FileText, Table, History, Map, ShieldCheck, LogIn, LogOut, 
  User, Sparkles, Building, Loader2, CloudLightning, RefreshCw, Layers,
  AlertCircle, Eye, EyeOff, Bell
} from 'lucide-react';
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, addDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from './firebase';
import { Resident, AuditLog, AppUser, UserRole, AppToast } from './types';
import Dashboard from './components/Dashboard';
import ResidentForm from './components/ResidentForm';
import ResidentTable from './components/ResidentTable';
import LogRiwayat from './components/LogRiwayat';
import PetaSebaran from './components/PetaSebaran';
import LandOfficePanel from './components/LandOfficePanel';
import PengaturanAkun from './components/PengaturanAkun';
import ToastContainer from './components/ToastContainer';

const LOCAL_RES_KEY = 'huntap_residents_cache';
const LOCAL_LOG_KEY = 'huntap_logs_cache';
const SESSION_USER_KEY = 'huntap_active_user';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [hasNewChanges, setHasNewChanges] = useState(false);
  const activeTabRef = React.useRef('dashboard');

  React.useEffect(() => {
    activeTabRef.current = activeTab;
    if (activeTab === 'riwayat') {
      setHasNewChanges(false);
    }
  }, [activeTab]);

  const [residents, setResidents] = useState<Resident[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  
  // Real-time Notification Center states
  const [notifications, setNotifications] = useState<AuditLog[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [focusedLogId, setFocusedLogId] = useState<string | null>(null);
  
  // App states
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  // Map locate state
  const [locateResident, setLocateResident] = useState<Resident | null>(null);

  // Active User Authentication State
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  
  // Login form inputs
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Real-time App Users list
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);

  // Dashboard filter pass state
  const [passFilterType, setPassFilterType] = useState('');
  const [passFilterValue, setPassFilterValue] = useState('');
  const [lastEditedResidentId, setLastEditedResidentId] = useState<string | null>(null);
  
  // Persistent ResidentTable filter states (lifted up to survive tab change and editing data)
  const [searchQuery, setSearchQuery] = useState('');
  const [selKecamatan, setSelKecamatan] = useState('');
  const [selDesa, setSelDesa] = useState('');
  const [selStatus, setSelStatus] = useState('');
  const [selBlok, setSelBlok] = useState('');
  
  // Real-time toast notifications state and refs to prevent stale closures
  const [toasts, setToasts] = useState<AppToast[]>([]);
  const currentUserRef = React.useRef<AppUser | null>(null);
  const addToastRef = React.useRef<(title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error', user?: string, aktivitas?: string) => void>(() => {});

  React.useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  React.useEffect(() => {
    addToastRef.current = (
      title: string, 
      message: string, 
      type: 'info' | 'success' | 'warning' | 'error' = 'info', 
      user?: string, 
      aktivitas?: string
    ) => {
      const newToast: AppToast = {
        id: `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title,
        message,
        type,
        user,
        aktivitas,
        timestamp: Date.now()
      };
      setToasts(prev => [newToast, ...prev].slice(0, 5));
    };
  }, []);

  // 1. Authenticate user from session storage
  useEffect(() => {
    const savedUser = sessionStorage.getItem(SESSION_USER_KEY);
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        sessionStorage.removeItem(SESSION_USER_KEY);
      }
    }
  }, []);

  // 2. Fetch and Seed Residents & Logs from Firestore
  useEffect(() => {
    setLoading(true);

    // Read offline cache first so the UI loads instantly
    const cacheRes = localStorage.getItem(LOCAL_RES_KEY);
    if (cacheRes) {
      try {
        setResidents(JSON.parse(cacheRes));
      } catch (_) {}
    }

    const cacheLogs = localStorage.getItem(LOCAL_LOG_KEY);
    if (cacheLogs) {
      try {
        setLogs(JSON.parse(cacheLogs));
      } catch (_) {}
    }

    // Subscribe to real-time changes from Firestore
    const unsubRes = onSnapshot(collection(db, 'huntap_data'), async (snapshot) => {
      let fetched: Resident[] = [];
      snapshot.forEach(doc => {
        fetched.push({ id: doc.id, ...doc.data() } as Resident);
      });

      // Sort residents by Nomor Rumah if available
      fetched.sort((a, b) => (a.nomorRumah || '').localeCompare(b.nomorRumah || ''));
      setResidents(fetched);
      localStorage.setItem(LOCAL_RES_KEY, JSON.stringify(fetched));
      setLoading(false);
    }, (error) => {
      console.warn('Real-time Firestore subscription failed (offline mode):', error);
      setLoading(false);
      // Do not throw a fatal error when offline or if connection fails temporarily.
      // This allows the app to operate seamlessly using local cached data.
    });

    let isInitialLogs = true;
    const unsubLogs = onSnapshot(collection(db, 'audit_logs'), (snapshot) => {
      const fetchedLogs: AuditLog[] = [];
      snapshot.forEach(doc => {
        fetchedLogs.push({ id: doc.id, ...doc.data() } as AuditLog);
      });

      // Show real-time toast notifications for new logs from other users/BPN
      if (!isInitialLogs) {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const logItem = { id: change.doc.id, ...change.doc.data() } as AuditLog;
            
            // Show notification for all relevant activities to guarantee real-time visibility
            const isCurrentUserAction = currentUserRef.current && logItem.pengguna === currentUserRef.current.namaLengkap;
            const relevantActivities = ['Tambah Data', 'Edit Data', 'Hapus Data', 'Update Progress', 'Import Excel'];
            
            if (relevantActivities.includes(logItem.aktivitas)) {
              if (activeTabRef.current !== 'riwayat') {
                setHasNewChanges(true);
              }
              
              // Add to real-time notification list
              setNotifications(prev => {
                if (prev.some(n => n.id === logItem.id)) return prev;
                return [logItem, ...prev];
              });
              
              let toastType: 'info' | 'success' | 'warning' | 'error' = 'info';
              if (logItem.aktivitas === 'Tambah Data') toastType = 'success';
              else if (logItem.aktivitas === 'Hapus Data') toastType = 'error';
              else if (logItem.aktivitas === 'Update Progress') toastType = 'success';
              else if (logItem.aktivitas === 'Edit Data') toastType = 'info';

              const displayUser = isCurrentUserAction 
                ? 'Anda (Sistem)' 
                : `${logItem.pengguna} (${logItem.role})`;

              const displayTitle = isCurrentUserAction
                ? `Aktivitas Anda: ${logItem.aktivitas}`
                : `Perubahan Real-time: ${logItem.aktivitas}`;

              if (addToastRef.current) {
                addToastRef.current(
                  displayTitle,
                  logItem.keterangan,
                  toastType,
                  displayUser,
                  logItem.aktivitas
                );
              }
            }
          }
        });
      }
      // Sort descending by timestamp
      fetchedLogs.sort((a, b) => {
        const getMs = (val: any) => {
          if (!val) return 0;
          if (typeof val === 'string') return new Date(val).getTime();
          if (typeof val.toMillis === 'function') return val.toMillis();
          if (typeof val.toDate === 'function') return val.toDate().getTime();
          if (val.seconds !== undefined) return val.seconds * 1000;
          return new Date(String(val)).getTime() || 0;
        };
        return getMs(b.timestamp) - getMs(a.timestamp);
      });
      setLogs(fetchedLogs);

      if (isInitialLogs) {
        const initialNotifs = fetchedLogs
          .filter(l => ['Tambah Data', 'Edit Data', 'Hapus Data', 'Update Progress', 'Import Excel'].includes(l.aktivitas))
          .slice(0, 4);
        setNotifications(initialNotifs);
      }

      isInitialLogs = false;
      localStorage.setItem(LOCAL_LOG_KEY, JSON.stringify(fetchedLogs));
    }, (error) => {
      console.warn('Real-time audit_logs subscription failed (offline mode):', error);
      // Do not throw a fatal error when offline or if connection fails temporarily.
    });

    return () => {
      unsubRes();
      unsubLogs();
    };
  }, []);

  // 2b. Fetch and Seed Users from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'app_users'), async (snapshot) => {
      const fetched: AppUser[] = [];
      snapshot.forEach((doc) => {
        fetched.push(doc.data() as AppUser);
      });
      setAppUsers(fetched);

      // Seed default admin if missing
      const hasAdmin = fetched.some(u => u.username === 'admin');
      if (!hasAdmin && fetched.length === 0) {
        try {
          const defaultAdmin: AppUser = {
            username: 'admin',
            password: 'admin',
            namaLengkap: 'Bima Admin Utama',
            role: 'Admin'
          };
          await setDoc(doc(db, 'app_users', 'admin'), defaultAdmin);
          console.log('Seeded default admin user to app_users collection.');
        } catch (e) {
          console.error('Failed to seed default admin user:', e);
        }
      }
    }, (error) => {
      console.warn('Real-time app_users subscription failed (offline/fresh mode):', error);
    });

    return () => unsub();
  }, []);

  // 3. Log user activity helper
  const logSystemActivity = async (
    activity: string, 
    keterangan: string, 
    oldData: any = null, 
    newData: any = null, 
    numRumah: string = '', 
    kkNama: string = ''
  ) => {
    const now = new Date();
    const logItem: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tanggal: now.toISOString().split('T')[0],
      jam: now.toTimeString().split(' ')[0],
      pengguna: currentUser ? currentUser.namaLengkap : 'Sistem',
      role: currentUser ? currentUser.role : 'Sistem',
      aktivitas: activity,
      nomorRumah: numRumah,
      namaPenerima: kkNama,
      keterangan,
      dataSebelum: oldData ? JSON.stringify(oldData) : null,
      dataSesudah: newData ? JSON.stringify(newData) : null,
      status: 'Berhasil',
      timestamp: now.toISOString()
    };

    try {
      await setDoc(doc(db, 'audit_logs', logItem.id), logItem);
    } catch (e) {
      // Local Fallback
      const currentLocalLogs = [logItem, ...logs];
      setLogs(currentLocalLogs);
      localStorage.setItem(LOCAL_LOG_KEY, JSON.stringify(currentLocalLogs));
      handleFirestoreError(e, OperationType.WRITE, `audit_logs/${logItem.id}`);
    }
  };

  // 4. Handle Authentications
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    const userClean = loginUsername.toLowerCase().trim();
    const passClean = loginPassword.trim();
    
    if (!userClean || !passClean) {
      setLoginError('Nama pengguna dan kata sandi wajib diisi!');
      return;
    }

    // Try matching with fetched app_users
    let matchedUser = appUsers.find(u => u.username === userClean);
    
    // Offline / Seeding Fallback
    if (!matchedUser && userClean === 'admin' && passClean === 'admin') {
      matchedUser = {
        username: 'admin',
        password: 'admin',
        namaLengkap: 'Bima Admin Utama',
        role: 'Admin'
      };
    }

    if (matchedUser) {
      if (matchedUser.password === passClean) {
        setCurrentUser(matchedUser);
        sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(matchedUser));
        logSystemActivity('Login', `User ${matchedUser.namaLengkap} (${matchedUser.role}) berhasil masuk ke sistem.`);
        setActiveTab('dashboard');
        
        // Clean inputs
        setLoginUsername('');
        setLoginPassword('');
        setLoginError('');
      } else {
        setLoginError('Kata sandi yang Anda masukkan salah!');
      }
    } else {
      setLoginError('Nama pengguna tidak terdaftar!');
    }
  };

  const handleLogout = () => {
    if (currentUser) {
      logSystemActivity('Logout', `User ${currentUser.namaLengkap} keluar dari sistem.`);
    }
    setCurrentUser(null);
    sessionStorage.removeItem(SESSION_USER_KEY);
    setActiveTab('dashboard');
  };

  // 5. Resident State Mutations
  const [editingResident, setEditingResident] = useState<Resident | null>(null);

  const handleSaveResident = async (residentData: Omit<Resident, 'lastUpdated' | 'updatedBy'>) => {
    setSyncing(true);
    const nowStr = new Date().toISOString();
    const isEdit = residents.some(r => r.id === residentData.id);
    const oldVal = isEdit ? residents.find(r => r.id === residentData.id) : null;

    const finalResident: Resident = {
      ...residentData,
      lastUpdated: nowStr,
      updatedBy: currentUser ? currentUser.namaLengkap : 'Petugas'
    };

    try {
      await setDoc(doc(db, 'huntap_data', finalResident.id), finalResident);
      
      // Auditing
      if (isEdit) {
        logSystemActivity(
          'Edit Data', 
          `Mengubah data unit ${finalResident.nomorRumah} - Kepala Keluarga: ${finalResident.nama}`,
          oldVal,
          finalResident,
          finalResident.nomorRumah,
          finalResident.nama
        );
      } else {
        logSystemActivity(
          'Tambah Data', 
          `Menambahkan data penerima huntap baru pada unit ${finalResident.nomorRumah} - Kepala Keluarga: ${finalResident.nama}`,
          null,
          finalResident,
          finalResident.nomorRumah,
          finalResident.nama
        );
      }
      
      setEditingResident(null);
      setLastEditedResidentId(finalResident.id);
      setActiveTab('rekapan');
    } catch (e: any) {
      alert(`Gagal menyimpan data ke Firestore: ${e.message || e}`);
      handleFirestoreError(e, OperationType.WRITE, `huntap_data/${finalResident.id}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteResident = async (id: string) => {
    const target = residents.find(r => r.id === id);
    if (!target) return;

    if (confirm(`Apakah Anda yakin ingin menghapus data unit ${target.nomorRumah} (${target.nama}) secara permanen?`)) {
      setSyncing(true);
      try {
        await deleteDoc(doc(db, 'huntap_data', id));
        logSystemActivity(
          'Hapus Data', 
          `Menghapus data unit ${target.nomorRumah} - Kepala Keluarga: ${target.nama} secara permanen.`,
          target,
          null,
          target.nomorRumah,
          target.nama
        );
      } catch (e: any) {
        alert(`Gagal menghapus data di Firestore: ${e.message || e}`);
        handleFirestoreError(e, OperationType.DELETE, `huntap_data/${id}`);
      } finally {
        setSyncing(false);
      }
    }
  };

  const handleImportExcelData = async (importedList: Resident[]) => {
    setSyncing(true);
    try {
      for (const res of importedList) {
        try {
          await setDoc(doc(db, 'huntap_data', res.id), res);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `huntap_data/${res.id}`);
        }
      }
      logSystemActivity(
        'Import Excel', 
        `Mengimpor ${importedList.length} data unit hunian baru dari berkas spreadsheet Excel.`
      );
    } catch (e: any) {
      alert(`Gagal mengunggah data import ke Firestore: ${e.message || e}`);
      handleFirestoreError(e, OperationType.WRITE, 'huntap_data');
    } finally {
      setSyncing(false);
    }
  };

  // 6. Land Office Updates & Submit App
  const handleUpdateResidentProgress = async (
    id: string, 
    step: number, 
    status: 'Sudah' | 'Belum' | 'Sedang Proses', 
    notes: string
  ) => {
    const target = residents.find(r => r.id === id);
    if (!target) return;

    const oldData = { ...target };
    const updatedResident: Resident = {
      ...target,
      progressStep: step,
      terimaSertipikat: status,
      catatanPetugas: notes,
      lastUpdated: new Date().toISOString(),
      updatedBy: currentUser ? currentUser.namaLengkap : 'BPN Verifikator'
    };

    try {
      await setDoc(doc(db, 'huntap_data', id), updatedResident);
      logSystemActivity(
        'Update Progress', 
        `Memperbarui kemajuan sertipikasi tanah unit ${target.nomorRumah} ke Tahap ${step} (Status: ${status})`,
        oldData,
        updatedResident,
        target.nomorRumah,
        target.nama
      );
    } catch (e: any) {
      alert(`Gagal memperbarui progress di Firestore: ${e.message || e}`);
      handleFirestoreError(e, OperationType.WRITE, `huntap_data/${id}`);
    }
  };

  const handleNewApplicationFromResident = async (appData: Omit<Resident, 'lastUpdated' | 'updatedBy'>) => {
    setSyncing(true);
    const nowStr = new Date().toISOString();
    const finalResident: Resident = {
      ...appData,
      lastUpdated: nowStr,
      updatedBy: currentUser ? currentUser.namaLengkap : 'Warga Pengaju'
    };

    try {
      await setDoc(doc(db, 'huntap_data', finalResident.id), finalResident);
      logSystemActivity(
        'Tambah Data', 
        `Mengajukan berkas sertipikasi secara online untuk unit ${finalResident.nomorRumah} - Nama: ${finalResident.nama}`,
        null,
        finalResident,
        finalResident.nomorRumah,
        finalResident.nama
      );
    } catch (e: any) {
      alert(`Gagal mengajukan berkas online: ${e.message || e}`);
      handleFirestoreError(e, OperationType.WRITE, `huntap_data/${finalResident.id}`);
    } finally {
      setSyncing(false);
    }
  };

  // 7. Log Deletion
  const handleDeleteLog = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'audit_logs', id));
    } catch (e: any) {
      alert(`Gagal menghapus log: ${e.message}`);
      handleFirestoreError(e, OperationType.DELETE, `audit_logs/${id}`);
    }
  };

  const handleClearAllLogs = async () => {
    try {
      let qSnap;
      try {
        qSnap = await getDocs(collection(db, 'audit_logs'));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'audit_logs');
      }
      qSnap.forEach(async (d) => {
        try {
          await deleteDoc(doc(db, 'audit_logs', d.id));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `audit_logs/${d.id}`);
        }
      });
      alert('Seluruh log audit riwayat berhasil dibersihkan.');
    } catch (e: any) {
      alert(`Gagal membersihkan log: ${e.message}`);
    }
  };

  const handleClearLogsByDate = async (date: string) => {
    try {
      let qSnap;
      try {
        qSnap = await getDocs(collection(db, 'audit_logs'));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'audit_logs');
      }
      let delCount = 0;
      qSnap.forEach(async (d) => {
        const item = d.data();
        if (item.tanggal === date) {
          try {
            await deleteDoc(doc(db, 'audit_logs', d.id));
            delCount++;
          } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, `audit_logs/${d.id}`);
          }
        }
      });
      alert(`Berhasil menghapus ${delCount} catatan log pada tanggal ${date}`);
    } catch (e: any) {
      alert(`Gagal menghapus log per tanggal: ${e.message}`);
    }
  };


  // 8. Navigation Helper
  const handleSelectFilterFromDashboard = (type: string, value: string) => {
    setPassFilterType(type);
    setPassFilterValue(value);
  };

  const handleLocateResidentFromTable = (resident: Resident) => {
    setLocateResident(resident);
    setActiveTab('peta');
  };

  const handleTriggerEdit = (resident: Resident) => {
    setEditingResident(resident);
    setActiveTab('input');
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col justify-between font-sans">
      
      {/* ----------------- LOGIN OVERLAY PAGE ----------------- */}
      {!currentUser && (
        <div className="flex-1 flex items-center justify-center p-4 py-16 bg-stone-100">
          <div className="bg-white rounded-3xl border border-stone-200 max-w-md w-full p-8 shadow-xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
            {/* Logo TAMBE HUB */}
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 inline-block mb-2">
              <h1 className="text-3xl font-black tracking-tighter text-blue-600 leading-none mb-1">
                HUNTAP<span className="text-orange-500 underline decoration-yellow-400">TAMBE</span>
              </h1>
              <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Portal Data Hunian</p>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-black text-stone-800 tracking-tight">Sertipikat Huntap Bima</h2>
              <p className="text-xs text-stone-500 max-w-xs mx-auto">
                Aplikasi pendaftaran, monitoring dokumen, dan fasilitasi legalitas hunian tetap pasca-bencana Kabupaten Bima.
              </p>
            </div>

            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 text-left">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Nama Pengguna (Username)</label>
                <input 
                  type="text" 
                  placeholder="Contoh: admin, staff_bolo, warga_a12" 
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').trim())}
                  className="px-4 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-stone-800 text-sm font-semibold focus:bg-white font-mono"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Kata Sandi (Password)</label>
                <div className="relative">
                  <input 
                    type={showLoginPassword ? 'text' : 'password'} 
                    placeholder="Masukkan kata sandi Anda" 
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-4 pr-10 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-stone-800 text-sm font-semibold focus:bg-white font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
                  >
                    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full py-3 rounded-full bg-blue-600 text-white font-black hover:bg-blue-700 shadow-lg shadow-blue-100 transition flex items-center justify-center gap-2 text-sm mt-2"
              >
                <LogIn className="h-4 w-4" /> Masuk ke Dashboard
              </button>
            </form>

            <div className="text-[10px] text-stone-400 font-bold border-t border-stone-100 pt-3 uppercase tracking-wider">
              Dinas PKP Kab. Bima / Bidang Pertanahan &copy; 2026
            </div>
          </div>
        </div>
      )}

      {/* ----------------- AUTHENTICATED APP WORKFLOW ----------------- */}
      {currentUser && (
        <>
          {/* Header Navigation Bar */}
          <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-100 px-6 py-3 shadow-sm">
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-4">
              {/* Logo TAMBEHUB style */}
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <h1 className="text-2xl font-black tracking-tighter text-blue-600 leading-none mb-0.5">
                    HUNTAP<span className="text-orange-500 underline decoration-yellow-400">TAMBE</span>
                  </h1>
                  <span className="text-[9px] text-stone-400 font-extrabold uppercase tracking-widest block">Portal Data &amp; Sertipikasi Huntap Tambe</span>
                </div>
              </div>

              {/* Navigation Menu Tabs */}
              <nav className="flex items-center gap-1 bg-stone-100 p-1 rounded-full border border-stone-200 flex-nowrap overflow-x-auto max-w-full justify-start lg:justify-center scrollbar-none shrink-0 whitespace-nowrap">
                <button 
                  onClick={() => { setActiveTab('dashboard'); }}
                  className={`px-4 py-1.5 rounded-full text-[11px] font-extrabold tracking-tight transition flex items-center gap-1.5 ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-md' : 'text-orange-500 hover:text-orange-700 hover:bg-orange-50/40'}`}
                >
                  <Home className="h-3.5 w-3.5" /> Dashboard
                </button>

                {currentUser.role !== 'Warga' && (
                  <button 
                    onClick={() => setActiveTab('input')}
                    className={`px-4 py-1.5 rounded-full text-[11px] font-extrabold tracking-tight transition flex items-center gap-1.5 ${activeTab === 'input' ? 'bg-blue-600 text-white shadow-md' : 'text-orange-500 hover:text-orange-700 hover:bg-orange-50/40'}`}
                  >
                    <FileText className="h-3.5 w-3.5" /> Input Data
                  </button>
                )}

                <button 
                  onClick={() => setActiveTab('rekapan')}
                  className={`px-4 py-1.5 rounded-full text-[11px] font-extrabold tracking-tight transition flex items-center gap-1.5 ${activeTab === 'rekapan' ? 'bg-blue-600 text-white shadow-md' : 'text-orange-500 hover:text-orange-700 hover:bg-orange-50/40'}`}
                >
                  <Table className="h-3.5 w-3.5" /> Data Penghuni
                </button>

                <button 
                  onClick={() => setActiveTab('bpn-service')}
                  className={`px-4 py-1.5 rounded-full text-[11px] font-extrabold tracking-tight transition flex items-center gap-1.5 ${activeTab === 'bpn-service' ? 'bg-blue-600 text-white shadow-md' : 'text-orange-500 hover:text-orange-700 hover:bg-orange-50/40'}`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Pengajuan BPN
                </button>

                <button 
                  onClick={() => setActiveTab('peta')}
                  className={`px-4 py-1.5 rounded-full text-[11px] font-extrabold tracking-tight transition flex items-center gap-1.5 ${activeTab === 'peta' ? 'bg-blue-600 text-white shadow-md' : 'text-orange-500 hover:text-orange-700 hover:bg-orange-50/40'}`}
                >
                  <Map className="h-3.5 w-3.5" /> Peta Sebaran
                </button>

                <button 
                  onClick={() => setActiveTab('riwayat')}
                  className={`px-4 py-1.5 rounded-full text-[11px] font-extrabold tracking-tight transition flex items-center gap-1.5 ${activeTab === 'riwayat' ? 'bg-blue-600 text-white shadow-md' : 'text-orange-500 hover:text-orange-700 hover:bg-orange-50/40'}`}
                >
                  <History className="h-3.5 w-3.5" /> Audit Log
                </button>

                {currentUser.role === 'Admin' && (
                  <button 
                    onClick={() => setActiveTab('pengaturan-akun')}
                    className={`px-4 py-1.5 rounded-full text-[11px] font-extrabold tracking-tight transition flex items-center gap-1.5 ${activeTab === 'pengaturan-akun' ? 'bg-blue-600 text-white shadow-md' : 'text-orange-500 hover:text-orange-700 hover:bg-orange-50/40'}`}
                  >
                    <User className="h-3.5 w-3.5" /> Pengaturan Akun
                  </button>
                )}
              </nav>

              {/* User Account Badging and Logout */}
              <div className="flex items-center gap-3">
                {/* Dedicated Notification Bell Icon & Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setIsNotificationOpen(!isNotificationOpen);
                      setHasNewChanges(false); // Mark as viewed when clicking
                    }}
                    className={`relative p-2.5 rounded-xl transition border flex items-center justify-center ${
                      hasNewChanges || notifications.length > 0
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-500 border-amber-200 shadow-xs' 
                        : 'bg-stone-50 hover:bg-stone-100 text-stone-400 hover:text-stone-700 border-stone-100'
                    }`}
                    title="Notifikasi Perubahan Data"
                  >
                    <Bell className={`h-4 w-4 ${hasNewChanges ? 'animate-bounce text-amber-500' : ''}`} />
                    {hasNewChanges && (
                      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                      </span>
                    )}
                    {notifications.length > 0 && !hasNewChanges && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white font-extrabold text-[8px] h-4 w-4 rounded-full flex items-center justify-center border border-white shadow-xs">
                        {notifications.length}
                      </span>
                    )}
                  </button>

                  {/* Notification Dropdown Container */}
                  {isNotificationOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-stone-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200">
                      <div className="px-4 py-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Bell className="h-4 w-4 text-amber-500" />
                          <span className="font-extrabold text-[11px] text-stone-800 uppercase tracking-wider">Notifikasi ({notifications.length})</span>
                        </div>
                        {notifications.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setNotifications([]);
                              setHasNewChanges(false);
                            }}
                            className="text-[10px] font-black text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100/70 px-2 py-1 rounded-lg transition"
                          >
                            Semua sudah dibaca
                          </button>
                        )}
                      </div>

                      <div className="max-h-72 overflow-y-auto divide-y divide-stone-150">
                        {notifications.length > 0 ? (
                          notifications.map((notif) => {
                            let itemColor = 'border-l-blue-500';
                            let bgColor = 'hover:bg-slate-50/50';
                            if (notif.aktivitas === 'Tambah Data') {
                              itemColor = 'border-l-emerald-500 bg-emerald-50/10';
                            } else if (notif.aktivitas === 'Hapus Data') {
                              itemColor = 'border-l-rose-500 bg-rose-50/10';
                            } else if (notif.aktivitas === 'Update Progress') {
                              itemColor = 'border-l-teal-500 bg-teal-50/10';
                            } else if (notif.aktivitas === 'Edit Data') {
                              itemColor = 'border-l-amber-500 bg-amber-50/10';
                            }

                            return (
                              <button
                                key={notif.id}
                                onClick={() => {
                                  setActiveTab('riwayat');
                                  setFocusedLogId(notif.id);
                                  setIsNotificationOpen(false);
                                  setNotifications(prev => prev.filter(n => n.id !== notif.id));
                                }}
                                className={`w-full p-3 text-left hover:bg-stone-50 transition flex flex-col gap-1 border-l-4 ${itemColor} ${bgColor}`}
                              >
                                <div className="flex justify-between items-start w-full">
                                  <span className="font-extrabold text-[10px] text-stone-800 uppercase tracking-tight">{notif.aktivitas}</span>
                                  <span className="text-[8px] font-bold text-stone-400 whitespace-nowrap">{notif.tanggal} {notif.jam}</span>
                                </div>
                                <p className="text-[10px] font-medium text-stone-600 line-clamp-2 leading-snug">{notif.keterangan}</p>
                                <div className="text-[8px] font-bold text-stone-400 flex justify-between items-center w-full mt-0.5">
                                  <span>Oleh: {notif.pengguna}</span>
                                  {notif.nomorRumah && (
                                    <span className="bg-stone-100 text-stone-600 font-extrabold px-1 py-0.5 rounded uppercase tracking-wider text-[8px]">
                                      Rumah {notif.nomorRumah}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="p-8 text-center text-stone-400 text-xs font-semibold">
                            Tidak ada notifikasi baru
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-stone-50 px-3 py-1.5 rounded-2xl border border-stone-200 shadow-xs">
                  <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                  <div>
                    <span className="text-[10px] font-extrabold text-stone-800 block leading-tight">{currentUser.namaLengkap}</span>
                    <span className="text-[8px] font-bold text-stone-400 uppercase tracking-wider block">{currentUser.role}</span>
                  </div>
                </div>

                <button 
                  onClick={handleLogout}
                  className="p-2 text-stone-400 hover:text-stone-700 bg-stone-50 hover:bg-stone-100 rounded-xl transition border border-stone-100"
                  title="Keluar dari Sistem"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Main Container Content */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            
            {/* Loading / Syncing HUD overlay */}
            {(loading || syncing) && (
              <div className="bg-blue-50 border border-blue-100 text-blue-700 p-3.5 rounded-2xl flex items-center justify-between gap-3 animate-pulse shadow-sm">
                <span className="text-xs font-bold flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> 
                  {syncing ? 'Sinkronisasi Basis Data Firestore...' : 'Memuat data perumahan huntap real-time...'}
                </span>
                <span className="text-[10px] font-bold uppercase bg-white/70 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <CloudLightning className="h-3.5 w-3.5 text-amber-500 animate-bounce" /> Live Cloud DB Connected
                </span>
              </div>
            )}

            {/* TAB CONTENTS */}
            <div className="animate-in fade-in duration-200">
              
              {activeTab === 'dashboard' && (
                <Dashboard 
                  residents={residents} 
                  onSelectFilter={handleSelectFilterFromDashboard} 
                  onNavigateToTab={setActiveTab}
                />
              )}

              {activeTab === 'input' && currentUser.role !== 'Warga' && (
                <ResidentForm 
                  editingResident={editingResident} 
                  onSave={handleSaveResident} 
                  onCancel={() => { setEditingResident(null); setActiveTab('rekapan'); }}
                  currentUser={currentUser.namaLengkap}
                  residents={residents}
                />
              )}

              {activeTab === 'rekapan' && (
                <ResidentTable 
                  residents={residents}
                  filterType={passFilterType}
                  filterValue={passFilterValue}
                  onClearFilter={() => { setPassFilterType(''); setPassFilterValue(''); }}
                  onEdit={handleTriggerEdit}
                  onDelete={handleDeleteResident}
                  onLocate={handleLocateResidentFromTable}
                  onImportExcel={handleImportExcelData}
                  onNavigateToTab={setActiveTab}
                  currentUserRole={currentUser.role}
                  lastEditedResidentId={lastEditedResidentId}
                  onClearLastEdited={() => setLastEditedResidentId(null)}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  selKecamatan={selKecamatan}
                  setSelKecamatan={setSelKecamatan}
                  selDesa={selDesa}
                  setSelDesa={setSelDesa}
                  selStatus={selStatus}
                  setSelStatus={setSelStatus}
                  selBlok={selBlok}
                  setSelBlok={setSelBlok}
                />
              )}

              {activeTab === 'bpn-service' && (
                <LandOfficePanel 
                  residents={residents} 
                  currentUser={currentUser}
                  onUpdateResidentProgress={handleUpdateResidentProgress}
                  onSubmitNewApplication={handleNewApplicationFromResident}
                />
              )}

              {activeTab === 'peta' && (
                <PetaSebaran 
                  residents={residents} 
                  locateResident={locateResident} 
                  onClearLocate={() => setLocateResident(null)}
                  onEdit={handleTriggerEdit}
                  currentUserRole={currentUser.role}
                />
              )}

              {activeTab === 'riwayat' && (
                <LogRiwayat 
                  logs={logs} 
                  onDeleteLog={handleDeleteLog}
                  onClearAllLogs={handleClearAllLogs}
                  onClearLogsByDate={handleClearLogsByDate}
                  currentUserRole={currentUser.role}
                  focusedLogId={focusedLogId}
                  onResetFocusedLog={() => setFocusedLogId(null)}
                />
              )}

              {activeTab === 'pengaturan-akun' && currentUser.role === 'Admin' && (
                <PengaturanAkun 
                  residents={residents} 
                  currentUser={currentUser}
                  logSystemActivity={logSystemActivity}
                />
              )}

            </div>
          </main>
        </>
      )}

      {/* Persistent Elegant Footer */}
      <footer className="bg-white border-t border-slate-100 py-6 px-6 text-center text-xs text-slate-400 font-bold">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>Bidang Pertanahan&copy; {new Date().getFullYear()}</span>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Pemerintah Kabupaten Bima</span>
            <span>&bull;</span>
            <span>Dinas Perumahan dan Kawasan Permukiman</span>
          </div>
        </div>
      </footer>

      {/* Real-Time Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

    </div>
  );
}
