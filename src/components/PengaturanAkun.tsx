/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, UserPlus, Trash2, Edit3, Search, Key, Shield, AlertCircle, 
  Check, Plus, X, Eye, EyeOff, UserX, UserCheck, ShieldCheck, Activity
} from 'lucide-react';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { Resident, AppUser, UserRole } from '../types';

interface PengaturanAkunProps {
  residents: Resident[];
  currentUser: AppUser;
  logSystemActivity: (
    activity: string, 
    keterangan: string, 
    oldData: any, 
    newData: any, 
    numRumah?: string, 
    kkNama?: string
  ) => void;
}

export default function PengaturanAkun({ 
  residents, 
  currentUser,
  logSystemActivity
}: PengaturanAkunProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form/Modal States
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('Warga');
  const [formNik, setFormNik] = useState('');
  
  // Visual States
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Subscribe to app_users in Firestore
  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(collection(db, 'app_users'), (snapshot) => {
      const fetched: AppUser[] = [];
      snapshot.forEach((doc) => {
        fetched.push({ ...doc.data() } as AppUser);
      });
      // Sort users: Admin first, then alphabetically by username
      fetched.sort((a, b) => {
        if (a.role === 'Admin' && b.role !== 'Admin') return -1;
        if (a.role !== 'Admin' && b.role === 'Admin') return 1;
        return a.username.localeCompare(b.username);
      });
      setUsers(fetched);
      setLoading(false);
    }, (error) => {
      console.error('Failed to subscribe to app_users:', error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Filtered users for search list
  const filteredUsers = useMemo(() => {
    const q = (searchQuery || '').toLowerCase();
    return users.filter(u => 
      (u.username || '').toLowerCase().includes(q) ||
      (u.namaLengkap || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  // Open Add Form
  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormUsername('');
    setFormPassword('');
    setFormFullName('');
    setFormRole('Warga');
    setFormNik('');
    setErrorMsg('');
    setSuccessMsg('');
    setIsOpenForm(true);
  };

  // Open Edit Form
  const handleOpenEdit = (user: AppUser) => {
    setEditingUser(user);
    setFormUsername(user.username);
    setFormPassword(user.password || '');
    setFormFullName(user.namaLengkap);
    setFormRole(user.role);
    setFormNik(user.nik || '');
    setErrorMsg('');
    setSuccessMsg('');
    setIsOpenForm(true);
  };

  // Form Submit Handler
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const usernameClean = formUsername.toLowerCase().replace(/[^a-z0-9_]/g, '').trim();
    if (!usernameClean) {
      setErrorMsg('Username tidak valid! Hanya diperbolehkan huruf kecil, angka, dan underscore.');
      return;
    }

    if (!formFullName.trim()) {
      setErrorMsg('Nama Lengkap wajib diisi!');
      return;
    }

    if (!formPassword || formPassword.length < 4) {
      setErrorMsg('Kata sandi wajib diisi dan minimal berukuran 4 karakter!');
      return;
    }

    if (formRole === 'Warga' && !formNik) {
      setErrorMsg('Pengguna dengan role "Warga" wajib menghubungkan NIK Kepala Keluarga!');
      return;
    }

    // Check duplication for new users
    if (!editingUser) {
      const isExist = users.some(u => u.username === usernameClean);
      if (isExist) {
        setErrorMsg(`Username "${usernameClean}" sudah digunakan pengguna lain!`);
        return;
      }
    }

    const savedUserData: AppUser = {
      username: usernameClean,
      namaLengkap: formFullName.trim(),
      role: formRole,
      password: formPassword,
      nik: formRole === 'Warga' ? formNik : ''
    };

    try {
      await setDoc(doc(db, 'app_users', usernameClean), savedUserData);
      
      // Audit Log
      logSystemActivity(
        editingUser ? 'Edit Akun' : 'Tambah Akun',
        `${editingUser ? 'Mengubah' : 'Membuat'} akun pengguna baru: @${usernameClean} (${formRole}) - ${formFullName}`,
        editingUser,
        savedUserData
      );

      setSuccessMsg(`Akun @${usernameClean} berhasil disimpan.`);
      setTimeout(() => {
        setIsOpenForm(false);
        setEditingUser(null);
      }, 1000);
    } catch (err) {
      setErrorMsg('Gagal menyimpan akun ke Firestore.');
      handleFirestoreError(err, OperationType.WRITE, `app_users/${usernameClean}`);
    }
  };

  // Delete User Account
  const handleDeleteUser = async (userToDelete: AppUser) => {
    if (userToDelete.username === currentUser.username) {
      alert('Anda tidak bisa menghapus akun Anda sendiri yang sedang aktif digunakan!');
      return;
    }

    if (userToDelete.username === 'admin') {
      alert('Akun administrator utama "admin" dilindungi dan tidak dapat dihapus!');
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus akun pengguna @${userToDelete.username} (${userToDelete.namaLengkap})?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'app_users', userToDelete.username));
      
      // Audit Log
      logSystemActivity(
        'Hapus Akun',
        `Menghapus akun pengguna: @${userToDelete.username} (${userToDelete.role}) - ${userToDelete.namaLengkap}`,
        userToDelete,
        null
      );

      alert(`Akun @${userToDelete.username} berhasil dihapus.`);
    } catch (err) {
      alert('Gagal menghapus akun.');
      handleFirestoreError(err, OperationType.DELETE, `app_users/${userToDelete.username}`);
    }
  };

  const togglePasswordVisibility = (username: string) => {
    setShowPasswordMap(prev => ({
      ...prev,
      [username]: !prev[username]
    }));
  };

  // Guard Clause for Non-Admin
  if (currentUser.role !== 'Admin') {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 rounded-3xl p-8 text-center space-y-4 max-w-lg mx-auto my-12 shadow-sm">
        <AlertCircle className="h-12 w-12 text-red-600 mx-auto animate-bounce" />
        <h3 className="text-lg font-black uppercase tracking-tight">Akses Ditolak!</h3>
        <p className="text-xs font-semibold leading-relaxed">
          Menu Pengaturan Akun dan peran eksklusif hanya dapat diakses oleh Administrator Utama (Admin) sistem HUNTAP TAMBE.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Intro Banner Header */}
      <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Shield className="h-5 w-5" />
            </span>
            <span className="text-[10px] uppercase font-black tracking-widest text-blue-600">Otoritas &amp; Keamanan</span>
          </div>
          <h2 className="text-xl font-black text-stone-800 tracking-tight">Manajemen Pengguna &amp; Akun</h2>
          <p className="text-xs text-stone-500 leading-relaxed font-semibold">
            Kelola akses terdaftar untuk petugas dinas, operator  pertanahan, tim surveyor lapangan, dan login eksklusif warga penerima manfaat.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-5 py-3 rounded-full bg-blue-600 text-white font-black hover:bg-blue-700 shadow-md shadow-blue-100 transition duration-200 flex items-center gap-2 text-xs shrink-0 active:scale-[0.97]"
        >
          <UserPlus className="h-4 w-4" /> Tambah Pengguna Baru
        </button>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        
        {/* Search header panel */}
        <div className="p-5 border-b border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-stone-50/50">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input 
              type="text" 
              placeholder="Cari berdasarkan nama, username, atau role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-2xl border border-stone-200 bg-white text-stone-800 text-xs focus:ring-2 focus:ring-blue-100 font-semibold"
            />
          </div>
          <div className="text-[10px] font-black text-stone-500 uppercase tracking-wider bg-stone-100 px-3 py-1.5 rounded-full">
            Total Terdaftar: <span className="text-blue-600">{users.length} Akun</span>
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-stone-400 font-bold text-xs flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
            Memuat daftar akun pengguna dari Cloud Firestore...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-16 text-center text-stone-400 font-bold text-xs flex flex-col items-center justify-center gap-4">
            <UserX className="h-12 w-12 text-stone-300" />
            Tidak ada pengguna yang cocok dengan kriteria pencarian.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-stone-600">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-900 font-extrabold font-display uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-6 w-12 text-center">No</th>
                  <th className="py-4 px-4">Nama Pengguna</th>
                  <th className="py-4 px-4">Nama Lengkap</th>
                  <th className="py-4 px-4">Hak Akses / Peran</th>
                  <th className="py-4 px-4">Koneksi NIK / Unit</th>
                  <th className="py-4 px-4">Kata Sandi (Password)</th>
                  <th className="py-4 px-6 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredUsers.map((u, idx) => {
                  const isCurrentUser = u.username === currentUser.username;
                  const matchingResident = u.role === 'Warga' && u.nik 
                    ? residents.find(r => r.nik === u.nik)
                    : null;

                  let roleBadge = 'bg-stone-50 text-stone-600 border-stone-200';
                  if (u.role === 'Admin') roleBadge = 'bg-red-50 text-red-700 border-red-100';
                  else if (u.role === 'Operator') roleBadge = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                  else if (u.role === 'Surveyor') roleBadge = 'bg-blue-50 text-blue-700 border-blue-100';
                  else if (u.role === 'Warga') roleBadge = 'bg-amber-50 text-amber-700 border-amber-100';

                  return (
                    <tr key={u.username} className={`hover:bg-stone-50/50 transition ${isCurrentUser ? 'bg-blue-50/20' : ''}`}>
                      <td className="py-3.5 px-6 font-bold text-center text-stone-400">{idx + 1}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-black text-stone-800 bg-stone-100 px-2 py-0.5 rounded-md">
                            @{u.username}
                          </span>
                          {isCurrentUser && (
                            <span className="text-[8px] bg-blue-600 text-white font-extrabold px-1.5 py-0.5 rounded uppercase">
                              Aktif
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-stone-800">{u.namaLengkap}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${roleBadge}`}>
                          {u.role === 'Operator' ? 'Operator' : u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {u.role === 'Warga' ? (
                          u.nik ? (
                            <div className="space-y-0.5">
                              <span className="font-mono text-[10px] font-bold text-stone-700 block">NIK: {u.nik}</span>
                              {matchingResident ? (
                                <span className="text-[9px] font-extrabold text-blue-600 block bg-blue-50 px-1.5 py-0.5 rounded w-max">
                                  Unit: {matchingResident.nomorRumah} ({matchingResident.desa})
                                </span>
                              ) : (
                                <span className="text-[9px] font-extrabold text-red-500 block">Unit tidak ditemukan</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-red-500 font-bold italic text-[10px]">Belum dihubungkan</span>
                          )
                        ) : (
                          <span className="text-stone-400 font-semibold text-[10px]">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-xs font-semibold text-stone-700 select-none">
                            {showPasswordMap[u.username] ? u.password : '••••••••'}
                          </span>
                          <button
                            onClick={() => togglePasswordVisibility(u.username)}
                            className="p-1 hover:bg-stone-100 rounded text-stone-400 hover:text-stone-700 transition"
                            title={showPasswordMap[u.username] ? 'Sembunyikan' : 'Tampilkan'}
                          >
                            {showPasswordMap[u.username] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="p-2 text-stone-500 hover:text-blue-600 bg-stone-50 hover:bg-blue-50 rounded-xl transition border border-stone-200/60"
                            title="Edit Akun"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={isCurrentUser || u.username === 'admin'}
                            className="p-2 text-stone-400 hover:text-red-600 bg-stone-50 hover:bg-red-50 rounded-xl transition border border-stone-200/60 disabled:opacity-40 disabled:hover:bg-stone-50 disabled:hover:text-stone-400"
                            title="Hapus Akun"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ----------------- FORM MODAL DIALOG ----------------- */}
      {isOpenForm && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-stone-200 w-full max-w-md p-6 shadow-xl space-y-5 animate-in zoom-in-95 duration-200 relative">
            <button
              onClick={() => setIsOpenForm(false)}
              className="absolute right-4 top-4 p-1.5 text-stone-400 hover:text-stone-700 bg-stone-50 hover:bg-stone-100 rounded-full transition"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                {editingUser ? <Edit3 className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              </span>
              <h3 className="font-black text-stone-800 text-sm uppercase tracking-wider">
                {editingUser ? 'Edit Akun Pengguna' : 'Tambah Pengguna Baru'}
              </h3>
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0" />
                {successMsg}
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-4 text-left">
              
              {/* Username field */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Username (Nama Pengguna)</label>
                <input 
                  type="text"
                  disabled={!!editingUser}
                  placeholder="Contoh: staff_bolo, bpn_operator, warga_a12"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="px-4 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-stone-800 text-xs font-semibold focus:bg-white disabled:opacity-50 font-mono"
                  required
                />
                {!editingUser && (
                  <p className="text-[9px] text-stone-400 font-semibold leading-tight">Hanya diperbolehkan huruf kecil, angka, dan underscore (_). Tidak bisa diubah setelah dibuat.</p>
                )}
              </div>

              {/* Password field */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Kata Sandi (Password)</label>
                <div className="relative">
                  <input 
                    type={showFormPassword ? 'text' : 'password'}
                    placeholder="Masukkan sandi minimal 4 karakter"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full px-4 pr-10 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-stone-800 text-xs font-semibold focus:bg-white font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPassword(!showFormPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
                  >
                    {showFormPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Full name field */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Nama Lengkap Pengguna</label>
                <input 
                  type="text"
                  placeholder="Contoh: Irwan Saputra, S.H."
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  className="px-4 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-stone-800 text-xs font-semibold focus:bg-white"
                  required
                />
              </div>

              {/* Access Role dropdown */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Hak Akses / Peran Sistem</label>
                <select 
                  value={formRole}
                  onChange={(e) => {
                    const newRole = e.target.value as UserRole;
                    setFormRole(newRole);
                    if (newRole !== 'Warga') {
                      setFormNik('');
                    }
                  }}
                  className="px-4 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-stone-800 text-xs font-bold focus:bg-white cursor-pointer"
                >
                  <option value="Admin">Administrator</option>
                  <option value="Operator">Operator</option>
                  <option value="Surveyor">Tim Surveyor Lapangan</option>
                  <option value="Warga">Warga Penerima Manfaat</option>
                </select>
              </div>

              {/* NIK selection for Warga role */}
              {formRole === 'Warga' && (
                <div className="flex flex-col gap-1 p-3 bg-amber-50/50 rounded-2xl border border-amber-100 animate-in slide-in-from-top-2 duration-200">
                  <label className="text-[10px] font-bold text-amber-800 uppercase tracking-widest flex items-center gap-1">
                    <Activity className="h-3 w-3" /> Hubungkan Ke Data Kavling Warga
                  </label>
                  <select 
                    value={formNik}
                    onChange={(e) => setFormNik(e.target.value)}
                    className="px-4 py-2 rounded-xl border border-amber-200 bg-white text-stone-800 text-xs font-semibold cursor-pointer mt-1"
                    required
                  >
                    <option value="">-- Pilih NIK / Kepala Keluarga --</option>
                    {residents.map(r => (
                      <option key={r.id} value={r.nik}>
                        {r.nik} - {r.nama} ({r.nomorRumah})
                      </option>
                    ))}
                  </select>
                  <p className="text-[9px] text-amber-700/80 mt-1.5 font-semibold leading-relaxed">
                    Menghubungkan akun ini ke NIK tertentu agar warga tersebut dapat memantau sertifikat pribadinya secara langsung.
                  </p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsOpenForm(false)}
                  className="flex-1 py-2.5 rounded-full border border-stone-200 text-stone-600 text-xs font-extrabold hover:bg-stone-50 active:scale-[0.97] transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-full bg-blue-600 text-white text-xs font-black hover:bg-blue-700 active:scale-[0.97] transition flex items-center justify-center gap-2"
                >
                  Simpan Akun
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
