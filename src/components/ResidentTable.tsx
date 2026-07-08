/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Eye, Edit2, Trash2, Map, Download, Upload, Search, X, Filter, 
  Check, FileSpreadsheet, Plus, HelpCircle, ChevronLeft, ChevronRight,
  MapPin, Phone, Calendar, User, FileText, Landmark, Key, Award, Clock, Ruler
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Resident, CERTIFICATION_STEPS } from '../types';

interface ResidentTableProps {
  residents: Resident[];
  filterType: string;
  filterValue: string;
  onClearFilter: () => void;
  onEdit: (resident: Resident) => void;
  onDelete: (id: string) => void;
  onLocate: (resident: Resident) => void;
  onImportExcel: (imported: Resident[]) => void;
  onNavigateToTab: (tabId: string) => void;
  currentUserRole: string;
  lastEditedResidentId?: string | null;
  onClearLastEdited?: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selKecamatan: string;
  setSelKecamatan: (kec: string) => void;
  selDesa: string;
  setSelDesa: (desa: string) => void;
  selStatus: string;
  setSelStatus: (status: string) => void;
  selBlok: string;
  setSelBlok: (blok: string) => void;
}

export default function ResidentTable({ 
  residents, 
  filterType, 
  filterValue, 
  onClearFilter, 
  onEdit, 
  onDelete, 
  onLocate, 
  onImportExcel, 
  onNavigateToTab,
  currentUserRole,
  lastEditedResidentId,
  onClearLastEdited,
  searchQuery,
  setSearchQuery,
  selKecamatan,
  setSelKecamatan,
  selDesa,
  setSelDesa,
  selStatus,
  setSelStatus,
  selBlok,
  setSelBlok
}: ResidentTableProps) {
  // Filters are now passed as props to persist state across tabs and updates

  // Auto-scroll and highlight edited resident
  React.useEffect(() => {
    if (lastEditedResidentId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`resident-row-${lastEditedResidentId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);

      const fadeTimer = setTimeout(() => {
        if (onClearLastEdited) {
          onClearLastEdited();
        }
      }, 4000);

      return () => {
        clearTimeout(timer);
        clearTimeout(fadeTimer);
      };
    }
  }, [lastEditedResidentId, onClearLastEdited]);

  // Detail Modal State
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);

  // Synchronize dashboard clicked filters
  React.useEffect(() => {
    if (filterType) {
      if (filterType === 'all') {
        setSelStatus('');
        setSelKecamatan('');
        setSelDesa('');
        setSelBlok('');
        setSearchQuery('');
      } else if (filterType && filterValue) {
        setSearchQuery('');
        setSelBlok('');
        if (filterType === 'terimaSertipikat') {
          setSelStatus(filterValue);
          setSelKecamatan('');
          setSelDesa('');
        } else if (filterType === 'dokumenTanah') {
          setSelStatus('');
          setSelKecamatan('');
          setSelDesa('');
        } else if (filterType === 'keterangan') {
          setSelStatus('');
          setSelKecamatan('');
          setSelDesa('');
        } else if (filterType === 'belum-ajukan') {
          setSelStatus('Belum');
          setSelKecamatan('');
          setSelDesa('');
        } else if (filterType === 'progressStep') {
          setSelStatus('');
          setSelKecamatan('');
          setSelDesa('');
        }
      }
    }
  }, [filterType, filterValue]);

  // Derived options for filter dropdowns
  const kecamatanOptions = useMemo(() => {
    const set = new Set(residents.map(r => r.kecamatan).filter(Boolean));
    return Array.from(set).sort();
  }, [residents]);

  const desaOptions = useMemo(() => {
    const filtered = selKecamatan 
      ? residents.filter(r => r.kecamatan === selKecamatan)
      : residents;
    const set = new Set(filtered.map(r => r.desa).filter(Boolean));
    return Array.from(set).sort();
  }, [residents, selKecamatan]);

  // Filter & Search Logic
  const filteredResidents = useMemo(() => {
    return residents.filter(r => {
      // 1. Dashboard specific filters
      if (filterType === 'belum-ajukan' && filterValue === 'belum-ajukan') {
        const text = ((r.dokumenTanah || '') + ' ' + (r.keterangan || '') + ' ' + (r.catatanPetugas || '')).toLowerCase();
        const isBelum = r.terimaSertipikat === 'Belum';
        const hasKendala =
          text.includes('tumpang') ||
          text.includes('tindih') ||
          text.includes('overlap') ||
          text.includes('shp') ||
          text.includes('shm') ||
          text.includes('lc');
        if (!(isBelum && !hasKendala)) return false;
      }

      if (filterType === 'dokumenTanah' && filterValue) {
        const text = ((r.dokumenTanah || '') + ' ' + (r.keterangan || '') + ' ' + (r.catatanPetugas || '')).toLowerCase();
        const val = filterValue.toLowerCase();
        if (val === 'sk') {
          const isSk = /\bsk\b/i.test(text) || (r.dokumenTanah || '').toLowerCase().includes('sk');
          if (!isSk) return false;
        } else {
          if (!text.includes(val)) return false;
        }
      }

      if (filterType === 'keterangan' && filterValue === 'tumpang') {
        const text = ((r.dokumenTanah || '') + ' ' + (r.keterangan || '') + ' ' + (r.catatanPetugas || '')).toLowerCase();
        const isOverlap = text.includes('tumpang') || text.includes('tindih') || text.includes('overlap') || text.includes('sengketa');
        if (!isOverlap) return false;
      }

      if (filterType === 'progressStep' && filterValue) {
        if (r.progressStep !== Number(filterValue)) return false;
      }

      // 2. Main Filters
      if (selKecamatan && r.kecamatan !== selKecamatan) return false;
      if (selDesa && r.desa !== selDesa) return false;
      if (selStatus && r.terimaSertipikat !== selStatus) return false;
      
      // Blok Filter
      if (selBlok) {
        const match = r.nomorRumah?.match(/^([A-Za-z0-9]+)/);
        const blok = match ? match[1].toUpperCase() : '';
        if (blok !== selBlok) return false;
      }

      // Search Query Match (Multiple fields)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const num = (r.nomorRumah || '').toLowerCase();
        const name = (r.nama || '').toLowerCase();
        const doc = (r.dokumenTanah || '').toLowerCase();
        const ket = ((r.keterangan || '') + ' ' + (r.catatanPetugas || '')).toLowerCase();
        const nikVal = (r.nik || '').toLowerCase();
        
        return num.includes(query) || name.includes(query) || doc.includes(query) || ket.includes(query) || nikVal.includes(query);
      }

      return true;
    });
  }, [residents, selKecamatan, selDesa, selStatus, selBlok, searchQuery, filterType, filterValue]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelKecamatan('');
    setSelDesa('');
    setSelStatus('');
    setSelBlok('');
    onClearFilter();
  };

  // Excel Import Handler
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const importedList: Resident[] = data.map((row, idx) => {
          const numHouse = row['NomorRumah'] || row['Nomor Rumah'] || row['No. Rumah'] || `X-${idx}`;
          const rawStatus = row['Status Sertipikat'] || row['Status'] || 'Belum';
          let status: 'Sudah' | 'Belum' | 'Sedang Proses' = 'Belum';
          if (rawStatus.toString().toLowerCase().includes('sudah') || rawStatus.toString().toLowerCase().includes('terbit') || rawStatus.toString() === 'Selesai') {
            status = 'Sudah';
          } else if (rawStatus.toString().toLowerCase().includes('proses') || rawStatus.toString().toLowerCase().includes('bpn')) {
            status = 'Sedang Proses';
          }

          return {
            id: `imported-${Date.now()}-${idx}`,
            nomorRumah: numHouse.toString().toUpperCase(),
            nama: row['Nama Kepala Keluarga'] || row['Nama'] || '',
            nik: (row['NIK'] || '').toString(),
            noKk: (row['No KK'] || row['Nomor KK'] || '').toString(),
            desa: row['Desa'] || row['Desa Asal'] || '',
            kecamatan: row['Kecamatan'] || row['Kecamatan Asal'] || '',
            luas: Number(row['Luas'] || row['Luas (m2)'] || 0),
            dokumenTanah: row['Alas Hak'] || row['Dokumen Tanah Asal'] || '',
            terimaSertipikat: status,
            noHp: (row['No HP'] || row['Nomor HP'] || '').toString(),
            koordinat: row['Koordinat'] || row['Google Maps'] || '',
            progressStep: status === 'Sudah' ? 5 : (status === 'Sedang Proses' ? 3 : 1),
            catatanPetugas: row['Catatan Petugas'] || row['Catatan petugas'] || row['catatan petugas'] || row['Catatan'] || row['Keterangan'] || '',
            keterangan: row['Catatan Petugas'] || row['Catatan petugas'] || row['catatan petugas'] || row['Catatan'] || row['Keterangan'] || '',
            lastUpdated: new Date().toISOString(),
            updatedBy: 'Sistem Import'
          };
        });

        onImportExcel(importedList);
        alert(`Berhasil mengimpor ${importedList.length} data resident baru!`);
      } catch (err: any) {
        alert(`Gagal memproses file Excel: ${err.message || err}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Excel Export Handler
  const handleExportExcel = () => {
    const wsData = filteredResidents.map(r => ({
      'Nomor Rumah': r.nomorRumah,
      'Nama Kepala Keluarga': r.nama,
      'NIK': r.nik,
      'No KK': r.noKk,
      'Desa': r.desa,
      'Kecamatan': r.kecamatan,
      'Luas (m2)': r.luas,
      'Dokumen Tanah Asal': r.dokumenTanah,
      'Status Sertipikat': r.terimaSertipikat,
      'Tahapan BPN': `Tahap ${r.progressStep}`,
      'No HP': r.noHp,
      'Koordinat': r.koordinat,
      'Catatan Petugas': r.catatanPetugas || ''
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Huntap Bima');
    XLSX.writeFile(wb, `Data_Huntap_Bima_${Date.now()}.xlsx`);
  };

  return (
    <div className="space-y-4 font-sans">
      {filterType && filterType !== 'all' && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-blue-600 shrink-0 animate-pulse" />
            <div className="text-xs font-semibold text-stone-700">
              <span className="font-extrabold text-blue-800">Filter Dashboard Aktif:</span>{' '}
              {filterType === 'dokumenTanah' && `Alas Hak / Dokumen Tanah "${filterValue}"`}
              {filterType === 'terimaSertipikat' && `Status Penerimaan Sertipikat "${filterValue}"`}
              {filterType === 'keterangan' && filterValue === 'tumpang' && `Kategori Kendala "Tumpang Tindih / Overlap"`}
              {filterType === 'belum-ajukan' && `Kategori "Belum Mengajukan (Kavling Kosong / Tanpa Kendala)"`}
              {filterType === 'progressStep' && `Proses BPN Tahap ${filterValue}: ${CERTIFICATION_STEPS.find(s => s.step.toString() === filterValue)?.label || ''}`}
              {' '}<span className="text-stone-500 font-bold">({filteredResidents.length} dari {residents.length} penerima ditemukan)</span>
            </div>
          </div>
          <button
            onClick={handleResetFilters}
            className="px-4 py-1 bg-white hover:bg-blue-100 border border-blue-200 rounded-full text-[10px] font-black uppercase tracking-wider text-blue-700 transition cursor-pointer"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Search & Filters Card */}
      <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-sm space-y-4">
        {/* Row 1: Search and Main Actions */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input 
              type="text" 
              placeholder="Cari berdasarkan nama, No. Rumah, atau dokumen..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); }}
              className="w-full pl-10 pr-4 py-2.5 rounded-full border border-stone-200 bg-stone-50 text-stone-800 text-sm focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {currentUserRole !== 'Warga' && (
              <>
                <button 
                  onClick={() => onNavigateToTab('input')}
                  className="px-5 py-2.5 rounded-full bg-blue-600 text-white font-extrabold text-xs hover:bg-blue-700 transition flex items-center gap-1.5 shadow-md shadow-blue-100"
                >
                  <Plus className="h-3.5 w-3.5" /> Tambah Data
                </button>
                <label className="px-5 py-2.5 rounded-full bg-stone-50 hover:bg-stone-100 border border-stone-200 text-orange-600 font-extrabold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs">
                  <Upload className="h-3.5 w-3.5" /> Import Excel
                  <input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="hidden" />
                </label>
              </>
            )}
            <button 
              onClick={handleExportExcel}
              className="px-5 py-2.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100/60 font-extrabold text-xs transition flex items-center gap-1.5 shadow-xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Export Excel
            </button>
          </div>
        </div>

        {/* Row 2: Dropdowns */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-stone-100">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Kecamatan</label>
            <select 
              value={selKecamatan}
              onChange={(e) => { setSelKecamatan(e.target.value); setSelDesa(''); }}
              className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Semua Kecamatan</option>
              {kecamatanOptions.map(kec => <option key={kec} value={kec}>{kec}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Desa</label>
            <select 
              value={selDesa}
              onChange={(e) => { setSelDesa(e.target.value); }}
              className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Semua Desa</option>
              {desaOptions.map(desa => <option key={desa} value={desa}>{desa}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Status Sertipikat</label>
            <select 
              value={selStatus}
              onChange={(e) => { setSelStatus(e.target.value); }}
              className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Semua Status</option>
              <option value="Belum">Belum Terbit (Diajukan)</option>
              <option value="Sedang Proses">Sedang Diproses (BPN)</option>
              <option value="Sudah">Sudah Terbit (Selesai)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Blok Kavling</label>
            <select 
              value={selBlok}
              onChange={(e) => { setSelBlok(e.target.value); }}
              className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Semua Blok</option>
              <option value="A">Blok A</option>
              <option value="B">Blok B</option>
              <option value="C">Blok C</option>
              <option value="D">Blok D</option>
              <option value="E">Blok E</option>
              <option value="J1">Blok J1</option>
              <option value="J2">Blok J2</option>
            </select>
          </div>

          <div className="flex items-end">
            <button 
              onClick={handleResetFilters}
              className="w-full py-1.5 rounded-xl border border-stone-200 hover:border-stone-300 font-extrabold text-xs text-stone-500 hover:text-stone-700 transition flex items-center justify-center gap-1 bg-stone-50 hover:bg-stone-100"
            >
              <X className="h-3.5 w-3.5" /> Reset Filter
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[600px]">
          <table className="w-full border-collapse text-left text-xs text-stone-600">
            <thead className="sticky top-0 bg-stone-50 z-10 shadow-[0_1px_0_0_rgba(120,113,108,0.15)]">
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-900 font-extrabold font-display uppercase tracking-wider">
                <th className="py-4 px-4 font-black text-center w-12 text-[10px] bg-stone-50">No</th>
                <th className="py-4 px-4 font-black text-center text-[10px] bg-stone-50">Unit Huntap</th>
                <th className="py-4 px-4 font-black text-[10px] bg-stone-50">Nama Penerima / KK</th>
                <th className="py-4 px-4 font-black text-[10px] bg-stone-50">Wilayah / Desa</th>
                <th className="py-4 px-4 font-black text-[10px] bg-stone-50">Alas Hak / Dokumen Asal</th>
                <th className="py-4 px-4 font-black text-[10px] bg-stone-50">Keterangan/Catatan</th>
                <th className="py-4 px-4 font-black text-center text-[10px] bg-stone-50">Luas (m²)</th>
                <th className="py-4 px-4 font-black text-center text-[10px] bg-stone-50">Status Sertipikat</th>
                <th className="py-4 px-4 font-black text-center text-[10px] bg-stone-50">Alur BPN</th>
                <th className="py-4 px-4 font-black text-center text-[10px] bg-stone-50">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredResidents.length > 0 ? (
                filteredResidents.map((item, index) => {
                  const itemIndex = index + 1;
                  
                  // Style configurations
                  let statusBadgeColor = 'bg-red-50 text-red-700 border-red-200';
                  if (item.terimaSertipikat === 'Sudah') {
                    statusBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200'; // Green
                  } else if (item.terimaSertipikat === 'Sedang Proses') {
                    statusBadgeColor = 'bg-yellow-50 text-yellow-700 border-yellow-200'; // Yellow
                  } else if (item.terimaSertipikat === 'Belum') {
                    statusBadgeColor = 'bg-red-50 text-red-700 border-red-200'; // Red
                  }

                  const isHighlighted = lastEditedResidentId === item.id;

                  return (
                    <tr 
                      id={`resident-row-${item.id}`}
                      key={item.id} 
                      className={`transition-all duration-500 ${isHighlighted ? 'bg-orange-100/60 border-y-2 border-orange-300 ring-2 ring-orange-200/50' : 'hover:bg-stone-50/50'}`}
                    >
                      <td className="py-3.5 px-4 font-extrabold text-center text-stone-400">{itemIndex}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg font-extrabold text-[11px] tracking-wider shadow-xs">
                          {item.nomorRumah}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-stone-900 text-sm tracking-tight">{item.nama}</div>
                        <div className="text-[10px] text-stone-400 font-mono">NIK: {item.nik || '-'}</div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-stone-700">
                        {item.desa}, <span className="text-stone-400">{item.kecamatan}</span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-stone-600 max-w-[150px] truncate" title={item.dokumenTanah}>
                        {item.dokumenTanah}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-stone-500 max-w-[150px] truncate" title={item.catatanPetugas || item.keterangan || ''}>
                        {item.catatanPetugas || item.keterangan || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-stone-800">{item.luas ? `${item.luas}` : '-'}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${statusBadgeColor}`}>
                          {item.terimaSertipikat === 'Sudah' ? 'Terbit' : (item.terimaSertipikat === 'Sedang Proses' ? 'Diproses' : 'Belum')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="bg-stone-100 border border-stone-200 text-stone-700 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider">
                          Tahap {item.progressStep} / 5
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            onClick={() => setSelectedResident(item)}
                            className="p-1.5 bg-pastel-blue-light text-pastel-blue hover:bg-pastel-blue hover:text-white rounded-lg transition"
                            title="Detail Lengkap"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          
                          {currentUserRole !== 'Warga' && (
                            <button 
                              onClick={() => onEdit(item)}
                              className="p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white rounded-lg transition"
                              title="Ubah Data"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {item.koordinat && (
                            <button 
                              onClick={() => onLocate(item)}
                              className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg transition"
                              title="Lokasi Peta"
                            >
                              <Map className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {currentUserRole === 'Admin' && (
                            <button 
                              onClick={() => onDelete(item.id)}
                              className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition"
                              title="Hapus"
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
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-semibold">
                    Tidak ada data penerima bantuan huntap yang sesuai filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Info Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50">
          <div className="text-xs text-slate-500 font-medium">
            Menampilkan <span className="font-extrabold text-slate-800">{filteredResidents.length}</span> kavling hunian (skrol ke bawah untuk data lainnya)
          </div>
        </div>
      </div>

      {/* Resident Detail Modal (Slide-out or Popup Overlay) */}
      {selectedResident && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-pastel-brown-light rounded-t-3xl">
              <div className="flex items-center gap-2">
                <span className="bg-pastel-blue text-white px-3 py-1 rounded-lg font-black text-sm">
                  {selectedResident.nomorRumah}
                </span>
                <h3 className="font-black text-slate-800 text-base">{selectedResident.nama}</h3>
              </div>
              <button 
                onClick={() => setSelectedResident(null)}
                className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Certification Steps Progress Bar */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                  Sertipikasi Alur / Progress Terkini
                </h4>
                
                {/* Horizontal progress steps map */}
                <div className="grid grid-cols-5 gap-1.5 relative pt-1.5">
                  {[1, 2, 3, 4, 5].map((s) => {
                    const isCompleted = s <= selectedResident.progressStep;
                    const isActive = s === selectedResident.progressStep;
                    return (
                      <div key={s} className="text-center space-y-1.5">
                        <div className="relative flex justify-center">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${isCompleted ? 'bg-pastel-blue text-white ring-4 ring-blue-100' : 'bg-slate-100 text-slate-400'}`}>
                            {isCompleted ? <Check className="h-3.5 w-3.5" /> : s}
                          </div>
                        </div>
                        <div className={`text-[9px] font-bold leading-tight ${isActive ? 'text-pastel-blue' : (isCompleted ? 'text-slate-700' : 'text-slate-400')}`}>
                          {s === 1 ? 'Berkas' : s === 2 ? 'Ukur' : s === 3 ? 'Panitia A' : s === 4 ? 'SK Hak' : 'SHM Terbit'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Resident Data */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-pastel-orange shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Kepala Keluarga</div>
                      <div className="text-xs font-bold text-slate-800">{selectedResident.nama}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Key className="h-4 w-4 text-pastel-orange shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">NIK / No. KK</div>
                      <div className="text-xs font-mono font-bold text-slate-700">
                        {selectedResident.nik || '-'} / {selectedResident.noKk || '-'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Phone className="h-4 w-4 text-pastel-orange shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Nomor Kontak / WA</div>
                      <div className="text-xs font-bold text-slate-700">{selectedResident.noHp || '-'}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-pastel-orange shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Lokasi Hunian</div>
                      <div className="text-xs font-bold text-slate-800">
                        Desa {selectedResident.desa}, Kec. {selectedResident.kecamatan}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">Koordinat: {selectedResident.koordinat || 'Belum diatur'}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Ruler className="h-4 w-4 text-pastel-orange shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Luas & Alas Hak Asal</div>
                      <div className="text-xs font-bold text-slate-800">
                        {selectedResident.luas} m² - <span className="text-slate-500 font-medium">{selectedResident.dokumenTanah}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-pastel-orange shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Terakhir Diperbarui</div>
                      <div className="text-xs font-bold text-slate-700">
                        {new Date(selectedResident.lastUpdated).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })} ({selectedResident.updatedBy})
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Catatan / Keterangan */}
              {selectedResident.catatanPetugas && (
                <div className="p-4 bg-orange-50/50 border border-orange-100 rounded-2xl">
                  <h5 className="text-[10px] font-black text-pastel-orange-dark uppercase tracking-wider mb-1">
                    Catatan Kantor Pertanahan / Petugas
                  </h5>
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">
                    {selectedResident.catatanPetugas}
                  </p>
                </div>
              )}

              {/* Image Previews / Files Attached */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                  Berkas Terunggah / Bukti Dokumen
                </h4>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Foto Rumah */}
                  <div className="border border-slate-100 rounded-xl p-2.5 text-center bg-slate-50">
                    <div className="text-[10px] font-bold text-slate-500 mb-1.5 truncate">Foto Rumah</div>
                    {selectedResident.fotoRumah ? (
                      <a href={selectedResident.fotoRumah} target="_blank" rel="noreferrer" className="block relative aspect-video rounded-lg overflow-hidden group">
                        <img src={selectedResident.fotoRumah} alt="Rumah" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-[10px] text-white font-bold">
                          Buka Gambar
                        </div>
                      </a>
                    ) : (
                      <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center text-[10px] text-slate-400">Belum ada</div>
                    )}
                  </div>

                  {/* Foto KTP */}
                  <div className="border border-slate-100 rounded-xl p-2.5 text-center bg-slate-50">
                    <div className="text-[10px] font-bold text-slate-500 mb-1.5 truncate">Foto KTP/KK</div>
                    {selectedResident.fotoKtpKk ? (
                      <a href={selectedResident.fotoKtpKk} target="_blank" rel="noreferrer" className="block relative aspect-video rounded-lg overflow-hidden group">
                        <img src={selectedResident.fotoKtpKk} alt="KTP KK" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-[10px] text-white font-bold">
                          Buka Gambar
                        </div>
                      </a>
                    ) : (
                      <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center text-[10px] text-slate-400">Belum ada</div>
                    )}
                  </div>

                  {/* Alas Hak */}
                  <div className="border border-slate-100 rounded-xl p-2.5 text-center bg-slate-50">
                    <div className="text-[10px] font-bold text-slate-500 mb-1.5 truncate">Alas Hak Asal</div>
                    {selectedResident.unggahDokTanah ? (
                      <a href={selectedResident.unggahDokTanah} target="_blank" rel="noreferrer" className="block relative aspect-video rounded-lg overflow-hidden group">
                        <img src={selectedResident.unggahDokTanah} alt="Dokumen" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-[10px] text-white font-bold">
                          Buka Gambar
                        </div>
                      </a>
                    ) : (
                      <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center text-[10px] text-slate-400">Belum ada</div>
                    )}
                  </div>

                  {/* SHM Baru */}
                  <div className="border border-slate-100 rounded-xl p-2.5 text-center bg-slate-50">
                    <div className="text-[10px] font-bold text-slate-500 mb-1.5 truncate">Cetak SHM</div>
                    {selectedResident.fotoShm ? (
                      <a href={selectedResident.fotoShm} target="_blank" rel="noreferrer" className="block relative aspect-video rounded-lg overflow-hidden group">
                        <img src={selectedResident.fotoShm} alt="SHM Baru" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-[10px] text-white font-bold">
                          Buka Gambar
                        </div>
                      </a>
                    ) : (
                      <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center text-[10px] text-slate-400">Belum ada</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 rounded-b-3xl flex justify-end gap-2">
              <button 
                onClick={() => setSelectedResident(null)}
                className="px-5 py-2 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 font-bold text-xs transition"
              >
                Tutup Detail
              </button>
              {selectedResident.koordinat && (
                <button 
                  onClick={() => {
                    onLocate(selectedResident);
                    setSelectedResident(null);
                  }}
                  className="px-5 py-2 rounded-full bg-pastel-blue text-white font-bold text-xs hover:bg-blue-600 transition flex items-center gap-1"
                >
                  <MapPin className="h-3.5 w-3.5" /> Lihat di Peta
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
