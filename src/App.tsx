/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Home, FileText, Table, History, Map, ShieldCheck, LogIn, LogOut, 
  User, Sparkles, Building, Loader2, CloudLightning, RefreshCw, Layers 
} from 'lucide-react';
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, addDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from './firebase';
import { Resident, AuditLog, AppUser, UserRole } from './types';
import { INITIAL_RESIDENTS } from './data';
import Dashboard from './components/Dashboard';
import ResidentForm from './components/ResidentForm';
import ResidentTable from './components/ResidentTable';
import LogRiwayat from './components/LogRiwayat';
import PetaSebaran from './components/PetaSebaran';
import LandOfficePanel from './components/LandOfficePanel';

const LOCAL_RES_KEY = 'huntap_residents_cache';
const LOCAL_LOG_KEY = 'huntap_logs_cache';
const SESSION_USER_KEY = 'huntap_active_user';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [residents, setResidents] = useState<Resident[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  
  // App states
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  // Map locate state
  const [locateResident, setLocateResident] = useState<Resident | null>(null);

  // Active User Authentication State
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  
  // Login form inputs
  const [loginUsername, setLoginUsername] = useState('');
  const [loginRole, setLoginRole] = useState<UserRole>('Admin');
  const [loginNik, setLoginNik] = useState('');
  const [loginFullName, setLoginFullName] = useState('');

  // Dashboard filter pass state
  const [passFilterType, setPassFilterType] = useState('');
  const [passFilterValue, setPassFilterValue] = useState('');

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

      // Seeding: If Firestore is empty, seed it with default data
      if (fetched.length === 0) {
        setSyncing(true);
        try {
          for (const res of INITIAL_RESIDENTS) {
            try {
              await setDoc(doc(db, 'huntap_data', res.id), res);
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, `huntap_data/${res.id}`);
            }
          }
          fetched = [...INITIAL_RESIDENTS];
        } catch (e) {
          console.warn('Gagal melakukan seeding default data ke Firestore:', e);
          fetched = [...INITIAL_RESIDENTS];
        } finally {
          setSyncing(false);
        }
      }

      // Sort residents by Nomor Rumah
      fetched.sort((a, b) => a.nomorRumah.localeCompare(b.nomorRumah));
      setResidents(fetched);
      localStorage.setItem(LOCAL_RES_KEY, JSON.stringify(fetched));
      setLoading(false);
    }, (error) => {
      console.warn('Real-time Firestore subscription failed (offline mode):', error);
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'huntap_data');
    });

    const unsubLogs = onSnapshot(collection(db, 'audit_logs'), (snapshot) => {
      const fetchedLogs: AuditLog[] = [];
      snapshot.forEach(doc => {
        fetchedLogs.push({ id: doc.id, ...doc.data() } as AuditLog);
      });

      // Sort descending by timestamp
      fetchedLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setLogs(fetchedLogs);
      localStorage.setItem(LOCAL_LOG_KEY, JSON.stringify(fetchedLogs));
    }, (error) => {
      console.warn('Real-time audit_logs subscription failed:', error);
      handleFirestoreError(error, OperationType.LIST, 'audit_logs');
    });

    return () => {
      unsubRes();
      unsubLogs();
    };
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
    if (!loginUsername.trim()) return;

    let fullName = loginFullName.trim() || loginUsername.trim();
    
    // Auto populate fields based on presets
    if (loginUsername === 'admin') {
      fullName = 'Bima Admin Utama';
    }

    const userData: AppUser = {
      username: loginUsername.toLowerCase().trim(),
      role: loginRole,
      namaLengkap: fullName,
      nik: loginNik.trim()
    };

    setCurrentUser(userData);
    sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(userData));
    logSystemActivity('Login', `User ${fullName} (${loginRole}) berhasil masuk ke sistem.`);
    setActiveTab('dashboard');

    // Clean inputs
    setLoginUsername('');
    setLoginFullName('');
    setLoginNik('');
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
                TAMBE<span className="text-orange-500 underline decoration-yellow-400">HUB</span>
              </h1>
              <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Portal Data Hunian</p>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-black text-stone-800 tracking-tight">Sertipikat Huntap Bima</h2>
              <p className="text-xs text-stone-500 max-w-xs mx-auto">
                Aplikasi pendaftaran, monitoring dokumen, dan fasilitasi legalitas hunian tetap pasca-bencana Kabupaten Bima.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Nama Pengguna (Username)</label>
                <input 
                  type="text" 
                  placeholder="Contoh: admin, bpn_staff, warga123" 
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="px-4 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-stone-800 text-sm font-semibold focus:bg-white"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Nama Lengkap (Tampilan)</label>
                <input 
                  type="text" 
                  placeholder="Nama Lengkap Anda" 
                  value={loginFullName}
                  onChange={(e) => setLoginFullName(e.target.value)}
                  className="px-4 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-stone-800 text-sm font-semibold focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Hak Akses / Role</label>
                  <select 
                    value={loginRole}
                    onChange={(e) => setLoginRole(e.target.value as UserRole)}
                    className="px-4 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-stone-800 text-xs font-bold focus:bg-white cursor-pointer"
                  >
                    <option value="Admin">Administrator</option>
                    <option value="Kantor Pertanahan">Kantor Pertanahan (BPN)</option>
                    <option value="Surveyor">Surveyor Lapangan</option>
                    <option value="Warga">Warga Penerima Huntap</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">NIK (Khusus Warga)</label>
                  <input 
                    type="text" 
                    maxLength={16}
                    placeholder="Wajib jika Role = Warga"
                    value={loginNik}
                    onChange={(e) => setLoginNik(e.target.value.replace(/\D/g, ''))}
                    className="px-4 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-stone-800 text-xs font-mono tracking-wider focus:bg-white"
                  />
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
              Kementerian Agraria dan Tata Ruang / BPN Bima &copy; 2026
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
                    TAMBE<span className="text-orange-500 underline decoration-yellow-400">HUB</span>
                  </h1>
                  <span className="text-[9px] text-stone-400 font-extrabold uppercase tracking-widest block">Portal Data &amp; Sertipikasi Huntap Bima</span>
                </div>
              </div>

              {/* Navigation Menu Tabs */}
              <nav className="flex items-center gap-1 bg-stone-100 p-1 rounded-full border border-stone-200 flex-wrap justify-center">
                <button 
                  onClick={() => { setActiveTab('dashboard'); }}
                  className={`px-4 py-1.5 rounded-full text-[11px] font-extrabold tracking-tight transition flex items-center gap-1.5 ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-md' : 'text-stone-500 hover:text-stone-800'}`}
                >
                  <Home className="h-3.5 w-3.5" /> Dashboard
                </button>

                {currentUser.role !== 'Warga' && (
                  <button 
                    onClick={() => setActiveTab('input')}
                    className={`px-4 py-1.5 rounded-full text-[11px] font-extrabold tracking-tight transition flex items-center gap-1.5 ${activeTab === 'input' ? 'bg-blue-600 text-white shadow-md' : 'text-stone-500 hover:text-stone-800'}`}
                  >
                    <FileText className="h-3.5 w-3.5" /> Input Data
                  </button>
                )}

                <button 
                  onClick={() => setActiveTab('rekapan')}
                  className={`px-4 py-1.5 rounded-full text-[11px] font-extrabold tracking-tight transition flex items-center gap-1.5 ${activeTab === 'rekapan' ? 'bg-blue-600 text-white shadow-md' : 'text-stone-500 hover:text-stone-800'}`}
                >
                  <Table className="h-3.5 w-3.5" /> Data Penghuni
                </button>

                <button 
                  onClick={() => setActiveTab('bpn-service')}
                  className={`px-4 py-1.5 rounded-full text-[11px] font-extrabold tracking-tight transition flex items-center gap-1.5 ${activeTab === 'bpn-service' ? 'bg-blue-600 text-white shadow-md' : 'text-stone-500 hover:text-stone-800'}`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Pengajuan BPN
                </button>

                <button 
                  onClick={() => setActiveTab('peta')}
                  className={`px-4 py-1.5 rounded-full text-[11px] font-extrabold tracking-tight transition flex items-center gap-1.5 ${activeTab === 'peta' ? 'bg-blue-600 text-white shadow-md' : 'text-stone-500 hover:text-stone-800'}`}
                >
                  <Map className="h-3.5 w-3.5" /> Peta Sebaran
                </button>

                <button 
                  onClick={() => setActiveTab('riwayat')}
                  className={`px-4 py-1.5 rounded-full text-[11px] font-extrabold tracking-tight transition flex items-center gap-1.5 ${activeTab === 'riwayat' ? 'bg-blue-600 text-white shadow-md' : 'text-stone-500 hover:text-stone-800'}`}
                >
                  <History className="h-3.5 w-3.5" /> Audit Log
                </button>
              </nav>

              {/* User Account Badging and Logout */}
              <div className="flex items-center gap-3">
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
                />
              )}

              {activeTab === 'riwayat' && (
                <LogRiwayat 
                  logs={logs} 
                  onDeleteLog={handleDeleteLog}
                  onClearAllLogs={handleClearAllLogs}
                  onClearLogsByDate={handleClearLogsByDate}
                  currentUserRole={currentUser.role}
                />
              )}

            </div>
          </main>
        </>
      )}

      {/* Persistent Elegant Footer */}
      <footer className="bg-white border-t border-slate-100 py-6 px-6 text-center text-xs text-slate-400 font-bold">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>Portal Pelayanan Pertanahan Kab. Bima &copy; {new Date().getFullYear()}</span>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Kantor BPN Bima</span>
            <span>&bull;</span>
            <span>Dinas Perkim Kab. Bima</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
