/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  History, Calendar, Filter, User, CheckCircle, Clock, Trash2, 
  Eye, FileSpreadsheet, Printer, RotateCcw, AlertCircle, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import * as XLSX from 'xlsx';
import { AuditLog } from '../types';

interface LogRiwayatProps {
  logs: AuditLog[];
  onDeleteLog: (id: string) => void;
  onClearAllLogs: () => void;
  onClearLogsByDate: (date: string) => void;
  currentUserRole: string;
}

export default function LogRiwayat({ 
  logs, 
  onDeleteLog, 
  onClearAllLogs, 
  onClearLogsByDate,
  currentUserRole 
}: LogRiwayatProps) {
  // Filter States
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [actQuery, setActQuery] = useState('');
  const [statusQuery, setStatusQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Detail Modal State
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Stats computation
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayLogs = logs.filter(l => l.tanggal === today);
    
    // User activity mapping
    const userCounts: { [key: string]: number } = {};
    let loginCount = 0;
    let editCount = 0;
    let addCount = 0;

    logs.forEach(l => {
      userCounts[l.pengguna] = (userCounts[l.pengguna] || 0) + 1;
      if (l.aktivitas === 'Login') loginCount++;
      if (l.aktivitas === 'Edit Data') editCount++;
      if (l.aktivitas === 'Tambah Data') addCount++;
    });

    const topUserEntry = Object.entries(userCounts).sort((a, b) => b[1] - a[1])[0];
    const topUser = topUserEntry ? `${topUserEntry[0]} (${topUserEntry[1]} ops)` : '-';

    return {
      todayCount: todayLogs.length,
      totalUsers: Object.keys(userCounts).length,
      topUser,
      loginCount,
      editCount,
      addCount
    };
  }, [logs]);

  // Chart Data: last 7 days activity counts
  const chartData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = logs.filter(l => l.tanggal === dateStr).length;
      
      // Formatting date label
      const dayLabel = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
      data.push({
        date: dateStr,
        label: dayLabel,
        'Aktivitas': count
      });
    }
    return data;
  }, [logs]);

  // Main Filtering Logic
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      if (dateFrom && l.tanggal < dateFrom) return false;
      if (dateTo && l.tanggal > dateTo) return false;
      if (userQuery && !l.pengguna.toLowerCase().includes(userQuery.toLowerCase())) return false;
      if (actQuery && l.aktivitas !== actQuery) return false;
      if (statusQuery && l.status !== statusQuery) return false;
      
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const ket = (l.keterangan || '').toLowerCase();
        const num = (l.nomorRumah || '').toLowerCase();
        const name = (l.namaPenerima || '').toLowerCase();
        const act = (l.aktivitas || '').toLowerCase();
        const user = (l.pengguna || '').toLowerCase();
        
        return ket.includes(query) || num.includes(query) || name.includes(query) || act.includes(query) || user.includes(query);
      }

      return true;
    });
  }, [logs, dateFrom, dateTo, userQuery, actQuery, statusQuery, searchQuery]);

  // Pagination compute
  const totalItems = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage]);

  const handleResetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setUserQuery('');
    setActQuery('');
    setStatusQuery('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleExportExcel = () => {
    const wsData = filteredLogs.map(l => ({
      Tanggal: l.tanggal,
      Jam: l.jam,
      Pengguna: l.pengguna,
      Role: l.role,
      Aktivitas: l.aktivitas,
      'No. Rumah': l.nomorRumah,
      'Nama Penerima': l.namaPenerima,
      Keterangan: l.keterangan,
      Status: l.status
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Log Riwayat');
    XLSX.writeFile(wb, `Log_Riwayat_Bima_${Date.now()}.xlsx`);
  };

  const handlePrintLogs = () => {
    window.print();
  };

  const handleDeleteByDatePrompt = () => {
    const targetDate = prompt('Masukkan tanggal yang ingin dihapus (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (targetDate) {
      if (confirm(`Apakah Anda yakin ingin menghapus seluruh log tanggal ${targetDate}?`)) {
        onClearLogsByDate(targetDate);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Statistics Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs text-center border-t-4 border-t-pastel-blue">
          <div className="text-2xl font-black text-pastel-blue">{stats.todayCount}</div>
          <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">Aktivitas Hari Ini</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs text-center border-t-4 border-t-green-500">
          <div className="text-2xl font-black text-green-600">{stats.totalUsers}</div>
          <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">Total Pengguna</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs text-center border-t-4 border-t-pastel-orange md:col-span-2">
          <div className="text-xs font-extrabold text-slate-800 truncate px-2">{stats.topUser}</div>
          <div className="text-[10px] text-slate-500 font-bold uppercase mt-2">Pengguna Teraktif</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs text-center border-t-4 border-t-pastel-yellow">
          <div className="text-2xl font-black text-yellow-600">{stats.loginCount}</div>
          <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">Sesi Login</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs text-center border-t-4 border-t-amber-700">
          <div className="text-2xl font-black text-amber-700">{stats.editCount + stats.addCount}</div>
          <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">Manipulasi Data</div>
        </div>
      </div>

      {/* 2. Charts & Date Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs lg:col-span-2">
          <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <History className="h-4.5 w-4.5 text-pastel-orange" /> Tren Aktivitas Sistem (7 Hari Terakhir)
          </h4>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="label" stroke="#888888" fontSize={9} tickLine={false} />
                <YAxis stroke="#888888" fontSize={9} tickLine={false} allowDecimals={false} />
                <Tooltip wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="Aktivitas" fill="#f97316" radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Audit Filter parameters */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-3.5">
          <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <Filter className="h-4 w-4 text-pastel-blue" /> Penyaringan Log Riwayat
          </h4>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase">Dari Tanggal</label>
              <input 
                type="date" 
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase">Hingga Tanggal</label>
              <input 
                type="date" 
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase">Jenis Aktivitas</label>
              <select 
                value={actQuery}
                onChange={(e) => setActQuery(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700"
              >
                <option value="">Semua</option>
                <option value="Login">Login</option>
                <option value="Logout">Logout</option>
                <option value="Tambah Data">Tambah Data</option>
                <option value="Edit Data">Edit Data</option>
                <option value="Hapus Data">Hapus Data</option>
                <option value="Update Progress">Update Progress</option>
                <option value="Import Excel">Import Excel</option>
                <option value="Export Excel">Export Excel</option>
                <option value="Sinkronisasi Firebase">Sinkronisasi</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase">Status Ops</label>
              <select 
                value={statusQuery}
                onChange={(e) => setStatusQuery(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700"
              >
                <option value="">Semua</option>
                <option value="Berhasil">Berhasil</option>
                <option value="Gagal">Gagal</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-500 uppercase">Cari Petugas / Pengguna</label>
            <input 
              type="text" 
              placeholder="Nama pengguna..."
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700"
            />
          </div>

          <button 
            onClick={handleResetFilters}
            className="w-full py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 font-bold text-xs text-slate-500 hover:text-slate-700 bg-slate-50 transition"
          >
            Reset Filter Log
          </button>
        </div>
      </div>

      {/* 3. Log Table List Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        {/* Header toolbar */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-slate-50/50">
          <div className="relative flex-1 max-w-sm">
            <input 
              type="text" 
              placeholder="Cari log (No. Rumah, nama, deskripsi)..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-4 pr-10 py-1.5 rounded-full border border-slate-200 bg-white text-slate-800 text-xs focus:bg-white"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button 
              onClick={handleExportExcel}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-bold text-xs text-slate-600 flex items-center gap-1 transition shadow-xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Export Excel
            </button>
            <button 
              onClick={handlePrintLogs}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-bold text-xs text-slate-600 flex items-center gap-1 transition shadow-xs"
            >
              <Printer className="h-3.5 w-3.5 text-pastel-blue" /> Cetak Log
            </button>

            {currentUserRole === 'Admin' && (
              <>
                <button 
                  onClick={handleDeleteByDatePrompt}
                  className="px-3.5 py-1.5 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold text-xs flex items-center gap-1 transition"
                >
                  <Calendar className="h-3.5 w-3.5" /> Hapus per Tanggal
                </button>
                <button 
                  onClick={() => {
                    if (confirm('Apakah Anda yakin ingin menghapus SELURUH LOG RIWAYAT secara permanen?')) {
                      onClearAllLogs();
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs flex items-center gap-1 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Kosongkan Log
                </button>
              </>
            )}
          </div>
        </div>

        {/* Table data */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs text-slate-600">
            <thead>
              <tr className="bg-slate-100/60 border-b border-slate-100 text-slate-700 font-bold">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">Pengguna (Role)</th>
                <th className="py-3 px-4">Aktivitas</th>
                <th className="py-3 px-4 text-center">Rumah / KK</th>
                <th className="py-3 px-4">Deskripsi / Detail Ops</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.length > 0 ? (
                paginatedLogs.map((log, idx) => {
                  const logIndex = (currentPage - 1) * itemsPerPage + idx + 1;
                  const isSuccess = log.status === 'Berhasil';
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/45 transition">
                      <td className="py-3 px-4 text-center text-slate-400 font-bold">{logIndex}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-700">{log.tanggal}</div>
                        <div className="text-[10px] text-slate-400 font-semibold">{log.jam}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-extrabold text-slate-800">{log.pengguna}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">{log.role}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-pastel-blue-light text-pastel-blue-dark border border-blue-50 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold">
                          {log.aktivitas}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {log.nomorRumah ? (
                          <div className="space-y-0.5">
                            <span className="bg-pastel-orange-light text-pastel-orange-dark font-extrabold px-1.5 py-0.5 rounded-lg text-[10px]">
                              {log.nomorRumah}
                            </span>
                            <div className="text-[9px] text-slate-500 font-bold truncate max-w-[100px]">{log.namaPenerima}</div>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-[240px] truncate font-medium text-slate-600" title={log.keterangan}>
                        {log.keterangan}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-0.5 font-bold ${isSuccess ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isSuccess ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            onClick={() => setSelectedLog(log)}
                            className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition"
                            title="Detail Log"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {currentUserRole === 'Admin' && (
                            <button 
                              onClick={() => onDeleteLog(log.id)}
                              className="p-1 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition"
                              title="Hapus Log"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-semibold">
                    Tidak ada catatan log aktivitas yang cocok
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50">
          <div className="text-xs text-slate-500 font-semibold">
            Menampilkan <span className="font-black text-slate-800">{Math.min(filteredLogs.length, itemsPerPage)}</span> dari <span className="font-black text-slate-800">{totalItems}</span> catatan audit log
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none transition"
            >
              <ChevronLeft className="h-3.5 w-3.5 text-slate-600" />
            </button>
            <span className="text-xs font-bold text-slate-700">
              Halaman {currentPage} dari {totalPages}
            </span>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none transition"
            >
              <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl max-w-xl w-full max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 bg-pastel-brown-light rounded-t-3xl flex justify-between items-center">
              <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
                <History className="h-4.5 w-4.5 text-pastel-orange" /> Rincian Transaksi / Audit Log
              </h3>
              <button 
                onClick={() => setSelectedLog(null)}
                className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase block">ID Transaksi</span>
                  <span className="font-mono font-bold text-slate-700">{selectedLog.id}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Waktu Ops</span>
                  <span className="font-bold text-slate-700">{selectedLog.tanggal} - {selectedLog.jam}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Petugas / Operator</span>
                  <span className="font-extrabold text-slate-800">{selectedLog.pengguna} ({selectedLog.role})</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Aktivitas</span>
                  <span className="font-bold text-pastel-blue-dark">{selectedLog.aktivitas}</span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase block mb-1">Rincian Operasi</span>
                <p className="text-xs font-semibold text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {selectedLog.keterangan}
                </p>
              </div>

              {/* Data Sebelum vs Data Sesudah Diff */}
              {(selectedLog.dataSebelum || selectedLog.dataSesudah) && (
                <div className="border-t border-slate-100 pt-3 space-y-3">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Perbandingan Data JSON</span>
                  
                  {selectedLog.dataSebelum && (
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-rose-600 uppercase block">Data Sebelum (Dihapus/Ubah)</span>
                      <pre className="text-[10px] bg-rose-50/50 p-3 rounded-xl border border-rose-100 overflow-x-auto text-rose-900 font-mono leading-relaxed max-h-32">
                        {JSON.stringify(JSON.parse(selectedLog.dataSebelum), null, 2)}
                      </pre>
                    </div>
                  )}

                  {selectedLog.dataSesudah && (
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-emerald-600 uppercase block">Data Sesudah (Ditambah/Baru)</span>
                      <pre className="text-[10px] bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 overflow-x-auto text-emerald-900 font-mono leading-relaxed max-h-32">
                        {JSON.stringify(JSON.parse(selectedLog.dataSesudah), null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 rounded-b-3xl flex justify-end">
              <button 
                onClick={() => setSelectedLog(null)}
                className="px-5 py-1.5 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 font-bold text-xs"
              >
                Tutup Detail Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
