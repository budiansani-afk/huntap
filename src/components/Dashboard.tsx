/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  FileText, Ruler, Users, Award, Home, CheckCircle, Clock, AlertTriangle, 
  Percent, ChevronRight, Info, MapPin, Sparkles, HelpCircle 
} from 'lucide-react';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend 
} from 'recharts';
import { Resident, CERTIFICATION_STEPS, LandCertificationStep } from '../types';

interface DashboardProps {
  residents: Resident[];
  onSelectFilter: (filterKey: string, filterValue: string) => void;
  onNavigateToTab: (tabId: string) => void;
}

export default function Dashboard({ residents, onSelectFilter, onNavigateToTab }: DashboardProps) {
  // Compute Stats
  const total = residents.length;
  const sudahCount = residents.filter(r => r.terimaSertipikat === 'Sudah').length;
  const belumCount = residents.filter(r => r.terimaSertipikat === 'Belum').length;
  const sedangProsesCount = residents.filter(r => r.terimaSertipikat === 'Sedang Proses').length;

  const percentageSudah = total > 0 ? Math.round((sudahCount / total) * 100) : 0;

  // Filter categorization statistics
  const skData = residents.filter(r => {
    const text = ((r.dokumenTanah || '') + ' ' + (r.keterangan || '') + ' ' + (r.catatanPetugas || '')).toLowerCase();
    return /\bsk\b/i.test(text) || (r.dokumenTanah || '').toLowerCase().includes('sk');
  });
  const skCount = skData.length;
  const skSudah = skData.filter(r => r.terimaSertipikat === 'Sudah').length;
  const skBelum = skCount - skSudah;
  const skProses = skData.filter(r => r.terimaSertipikat === 'Sedang Proses').length;
  
  // Calculate count of residents whose description/notes contain the word 'SK' and status is 'Belum'
  const belumSKKeteranganCount = residents.filter(r => {
    const text = ((r.keterangan || '') + ' ' + (r.catatanPetugas || '') + ' ' + (r.dokumenTanah || '')).toLowerCase();
    return text.includes('sk') && r.terimaSertipikat === 'Belum';
  }).length;

  // Naming Target target of SK (standard list)
  const targetSK = 174;

  const belumSKCount = Math.max(0, residents.length - targetSK);
  const selisihSK = Math.max(0, targetSK - skCount);

  const shpData = residents.filter(r => {
    const text = ((r.dokumenTanah || '') + ' ' + (r.keterangan || '') + ' ' + (r.catatanPetugas || '')).toLowerCase();
    return text.includes('shp');
  });
  const shpCount = shpData.length;

  const shmData = residents.filter(r => {
    const text = ((r.dokumenTanah || '') + ' ' + (r.keterangan || '') + ' ' + (r.catatanPetugas || '')).toLowerCase();
    return text.includes('shm');
  });
  const shmCount = shmData.length;

  const lcData = residents.filter(r => {
    const text = ((r.dokumenTanah || '') + ' ' + (r.keterangan || '') + ' ' + (r.catatanPetugas || '')).toLowerCase();
    return text.includes('lc');
  });
  const lcCount = lcData.length;

  const overlapData = residents.filter(r => {
    const txt = ((r.dokumenTanah || '') + ' ' + (r.keterangan || '') + ' ' + (r.catatanPetugas || '')).toLowerCase();
    return txt.includes('tumpang') || txt.includes('tindih') || txt.includes('overlap') || txt.includes('sengketa');
  });
  const overlapCount = overlapData.length;

  const belumAjukanData = residents.filter(r => {
    const text = ((r.dokumenTanah || '') + ' ' + (r.keterangan || '') + ' ' + (r.catatanPetugas || '')).toLowerCase();
    const isBelum = r.terimaSertipikat === 'Belum';
    const hasKendala =
      text.includes('tumpang') ||
      text.includes('tindih') ||
      text.includes('overlap') ||
      text.includes('shp') ||
      text.includes('shm') ||
      text.includes('lc');
    return isBelum && !hasKendala;
  });
  const belumAjukanCount = belumAjukanData.length;

  // Pie Chart Data for status matching table badges
  const statusPieData = [
    { name: 'Sudah Terbit', value: sudahCount, color: '#10b981' }, // Green (Emerald-500)
    { name: 'Sedang Proses', value: sedangProsesCount, color: '#f59e0b' }, // Yellow (Amber-500)
    { name: 'Belum Diajukan', value: belumCount, color: '#ef4444' } // Red (Red-500)
  ].filter(item => item.value > 0);

  // Bar Chart Data for Kendala Pertanahan
  const kendalaChartData = [
    { name: 'Ada SHP Asal', 'Kavling': shpCount, color: '#64748b' },
    { name: 'Ada SHM Asal', 'Kavling': shmCount, color: '#3b82f6' },
    { name: 'Konsolidasi LC', 'Kavling': lcCount, color: '#f59e0b' },
    { name: 'Overlap/Tumpang', 'Kavling': overlapCount, color: '#ef4444' }
  ];

  // Bar Chart Data for Kecamatan
  const kecMap: { [key: string]: { total: number; sudah: number } } = {};
  residents.forEach(r => {
    const kec = r.kecamatan || 'Lainnya';
    if (!kecMap[kec]) {
      kecMap[kec] = { total: 0, sudah: 0 };
    }
    kecMap[kec].total += 1;
    if (r.terimaSertipikat === 'Sudah') {
      kecMap[kec].sudah += 1;
    }
  });

  const kecChartData = Object.keys(kecMap).map(kec => ({
    name: kec,
    'Total Penerima': kecMap[kec].total,
    'Sertipikat Selesai': kecMap[kec].sudah
  })).sort((a, b) => b['Total Penerima'] - a['Total Penerima']).slice(0, 5);

  // Progress step statistics
  const stepCounts = [0, 0, 0, 0, 0, 0];
  residents.forEach(r => {
    if (r.progressStep >= 1 && r.progressStep <= 5) {
      stepCounts[r.progressStep] += 1;
    }
  });

  // Blok/Cluster classification
  const getBlok = (nomorRumah: string): string => {
    if (!nomorRumah) return 'Lainnya';
    const match = nomorRumah.match(/^([A-Za-z0-9]+)/);
    return match ? match[1].toUpperCase() : 'Lainnya';
  };

  const blokMap: { [key: string]: { total: number; sudah: number } } = {};
  residents.forEach(r => {
    const blok = getBlok(r.nomorRumah);
    if (!blokMap[blok]) {
      blokMap[blok] = { total: 0, sudah: 0 };
    }
    blokMap[blok].total += 1;
    if (r.terimaSertipikat === 'Sudah') {
      blokMap[blok].sudah += 1;
    }
  });

  const blokChartData = Object.keys(blokMap).map(blok => ({
    name: `Blok ${blok}`,
    'Total Kavling': blokMap[blok].total,
    'Sudah Sertipikat': blokMap[blok].sudah
  })).sort((a, b) => a.name.localeCompare(b.name));

  const handleCardClick = (type: string, val: string) => {
    onSelectFilter(type, val);
    onNavigateToTab('rekapan');
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Welcome Banner */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-600 text-white rounded-xl"><Sparkles className="h-4 w-4" /></span>
            <h2 className="text-2xl font-black font-display text-stone-900 tracking-tight">Sertipikasi Tanah Huntap</h2>
          </div>
          <p className="text-xs font-medium text-stone-500">
            Sistem monitoring real-time proses sertipikasi tanah Hunian Tetap Kabupaten Bima terintegrasi Kantor Pertanahan.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-stone-50 px-4 py-2.5 rounded-full border border-stone-200 text-xs font-bold text-stone-700 shadow-xs">
          <MapPin className="h-4 w-4 text-orange-500" />
          <span>Tambe-Bolo, Kabupaten Bima-NTB</span>
        </div>
      </div>

      {/* Main Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Residents */}
        <div 
          onClick={() => handleCardClick('all', '')}
          className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition duration-300 cursor-pointer relative overflow-hidden group border-t-4 border-t-blue-600"
        >
          <div className="absolute right-4 top-4 text-blue-600 opacity-10 group-hover:opacity-20 transition-opacity">
            <Home className="h-10 w-10" />
          </div>
          <div className="text-stone-400 text-[10px] font-black uppercase tracking-widest">Total Penerima</div>
          <div className="text-3xl font-black font-display text-stone-900 mt-2">{total}</div>
          <div className="text-xs text-blue-600 font-bold mt-1">Hunian Tetap</div>
        </div>

        {/* Sudah Sertipikat */}
        <div 
          onClick={() => handleCardClick('terimaSertipikat', 'Sudah')}
          className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition duration-300 cursor-pointer relative overflow-hidden group border-t-4 border-t-green-600"
        >
          <div className="absolute right-4 top-4 text-green-600 opacity-10 group-hover:opacity-20 transition-opacity">
            <CheckCircle className="h-10 w-10" />
          </div>
          <div className="text-stone-400 text-[10px] font-black uppercase tracking-widest">Sudah Terbit</div>
          <div className="text-3xl font-black font-display text-green-600 mt-2">{sudahCount}</div>
          <div className="text-xs text-green-600 font-bold mt-1 flex items-center gap-1">
            <Percent className="h-3 w-3" /> {percentageSudah}% Dari Total
          </div>
        </div>

        {/* Sedang Proses */}
        <div 
          onClick={() => handleCardClick('terimaSertipikat', 'Sedang Proses')}
          className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition duration-300 cursor-pointer relative overflow-hidden group border-t-4 border-t-orange-600"
        >
          <div className="absolute right-4 top-4 text-orange-600 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock className="h-10 w-10" />
          </div>
          <div className="text-stone-400 text-[10px] font-black uppercase tracking-widest">Sedang Proses</div>
          <div className="text-3xl font-black font-display text-orange-600 mt-2">{sedangProsesCount}</div>
          <div className="text-xs text-orange-600 font-bold mt-1">Kantor Pertanahan</div>
        </div>

        {/* Belum Diajukan */}
        <div 
          onClick={() => handleCardClick('terimaSertipikat', 'Belum')}
          className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition duration-300 cursor-pointer relative overflow-hidden group border-t-4 border-t-yellow-500"
        >
          <div className="absolute right-4 top-4 text-yellow-500 opacity-10 group-hover:opacity-20 transition-opacity">
            <FileText className="h-10 w-10" />
          </div>
          <div className="text-stone-400 text-[10px] font-black uppercase tracking-widest">Belum Diajukan</div>
          <div className="text-3xl font-black font-display text-yellow-600 mt-2">{belumCount}</div>
          <div className="text-xs text-yellow-600 font-bold mt-1">Lengkapi berkas</div>
        </div>

        {/* Overlap / Sengketa */}
        <div 
          onClick={() => handleCardClick('keterangan', 'tumpang')}
          className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition duration-300 cursor-pointer relative overflow-hidden group border-t-4 border-t-red-600"
        >
          <div className="absolute right-4 top-4 text-red-600 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <div className="text-stone-400 text-[10px] font-black uppercase tracking-widest">Tumpang Tindih</div>
          <div className="text-3xl font-black font-display text-red-600 mt-2">{overlapCount}</div>
          <div className="text-xs text-red-600 font-bold mt-1">Perlu Verifikasi</div>
        </div>
      </div>

      {/* Document Category Panel - Fokus Sertipikasi Tanah */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Info className="h-5 w-5 text-blue-600" />
          <h3 className="text-xs font-black text-stone-900 uppercase tracking-widest font-display">Dokumen &amp; Sertipikat</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {/* SK Bupati */}
          <div 
            onClick={() => handleCardClick('dokumenTanah', 'SK')}
            className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 text-center cursor-pointer hover:bg-blue-100 hover:scale-[1.03] hover:shadow-xs active:scale-[0.97] transition duration-200"
          >
            <div className="text-xl font-black font-display text-blue-700">{skCount}</div>
            <div className="text-xs font-bold text-stone-800 mt-1">SK Bupati</div>
            <div className="text-[10px] text-stone-500 mt-1">
              <span className="text-green-600 font-bold">{skSudah} Sudah</span> | <span className="text-orange-600 font-bold">{skBelum} Belum</span>
            </div>
          </div>

          {/* Selisih SK target */}
          <div 
            onClick={() => handleCardClick('dokumenTanah', 'SK')}
            className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100 text-center cursor-pointer hover:bg-orange-100 hover:scale-[1.03] hover:shadow-xs active:scale-[0.97] transition duration-200"
          >
            <div className="text-xl font-black font-display text-orange-700">{selisihSK}</div>
            <div className="text-xs font-bold text-stone-800 mt-1">Perlu Singkron SK</div>
            <div className="text-[10px] text-stone-500 mt-1 font-bold">Dalam SK: {targetSK}</div>
            <div className="text-[10px] text-orange-600 mt-0.5 font-bold">Belum SK: {belumSKCount}</div>
          </div>

          {/* SHP Asal */}
          <div 
            onClick={() => handleCardClick('dokumenTanah', 'SHP')}
            className="bg-stone-50 p-4 rounded-2xl border border-stone-200 text-center cursor-pointer hover:bg-stone-100 hover:scale-[1.03] hover:shadow-xs active:scale-[0.97] transition duration-200"
          >
            <div className="text-xl font-black font-display text-stone-800">{shpCount}</div>
            <div className="text-xs font-bold text-stone-800 mt-1">Ada SHP</div>
            <div className="text-[10px] text-stone-500 mt-1">Sertipikat Hak Pakai</div>
          </div>

          {/* SHM Asal */}
          <div 
            onClick={() => handleCardClick('dokumenTanah', 'SHM')}
            className="bg-stone-50 p-4 rounded-2xl border border-stone-200 text-center cursor-pointer hover:bg-stone-100 hover:scale-[1.03] hover:shadow-xs active:scale-[0.97] transition duration-200"
          >
            <div className="text-xl font-black font-display text-stone-800">{shmCount}</div>
            <div className="text-xs font-bold text-stone-800 mt-1">Ada SHM</div>
            <div className="text-[10px] text-stone-500 mt-1">Sertipikat Hak Milik</div>
          </div>

          {/* Land Consolidation (LC) */}
          <div 
            onClick={() => handleCardClick('dokumenTanah', 'LC')}
            className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 text-center cursor-pointer hover:bg-amber-100 hover:scale-[1.03] hover:shadow-xs active:scale-[0.97] transition duration-200"
          >
            <div className="text-xl font-black font-display text-amber-700">{lcCount}</div>
            <div className="text-xs font-bold text-stone-800 mt-1">Konsolidasi Tanah/LC</div>
            <div className="text-[10px] text-stone-500 mt-1">Masuk Bidangan LC</div>
          </div>

          {/* Overlap / Tumpang Tindih */}
          <div 
            onClick={() => handleCardClick('keterangan', 'tumpang')}
            className="bg-rose-50/60 p-4 rounded-2xl border border-rose-100 text-center cursor-pointer hover:bg-rose-100 hover:scale-[1.03] hover:shadow-xs active:scale-[0.97] transition duration-200"
          >
            <div className="text-xl font-black font-display text-red-600">{overlapCount}</div>
            <div className="text-xs font-bold text-stone-800 mt-1">Overlap</div>
            <div className="text-[10px] text-stone-500 mt-1">Mediasi</div>
          </div>

          {/* Belum Diajukan */}
          <div 
            onClick={() => handleCardClick('belum-ajukan', 'belum-ajukan')}
            className="bg-stone-100 p-4 rounded-2xl border border-stone-200 text-center cursor-pointer hover:bg-stone-200 hover:scale-[1.03] hover:shadow-xs active:scale-[0.97] transition duration-200"
          >
            <div className="text-xl font-black font-display text-stone-600">{belumAjukanCount}</div>
            <div className="text-xs font-bold text-stone-800 mt-1">Belum Ajukan</div>
            <div className="text-[10px] text-stone-500 mt-1">Lengkapi berkas</div>
          </div>
        </div>
      </div>

      {/* Certification Flow/Pipeline Explanation */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-pastel-orange" />
            <h3 className="font-bold text-slate-800">Alur Pengajuan Sertipikasi Tanah Hunian Tetap</h3>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <HelpCircle className="h-3 w-3" />Layanan Kantor Pertanahan Kab. Bima
          </div>
        </div>

        {/* Interactive Steps Visualizer */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
          {CERTIFICATION_STEPS.map((stepItem: LandCertificationStep) => {
            const countOnThisStep = stepCounts[stepItem.step];
            return (
              <div 
                key={stepItem.step} 
                onClick={() => handleCardClick('progressStep', stepItem.step.toString())}
                className="bg-pastel-brown-light/40 p-4 rounded-2xl border border-amber-50 relative flex flex-col justify-between cursor-pointer hover:scale-[1.02] hover:bg-amber-100/30 hover:border-amber-200 hover:shadow-sm active:scale-[0.98] transition duration-200"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="w-6 h-6 flex items-center justify-center bg-pastel-blue text-white rounded-full text-xs font-bold">
                      {stepItem.step}
                    </span>
                    {countOnThisStep > 0 && (
                      <span className="bg-pastel-orange text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                        {countOnThisStep} Kavling
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{stepItem.label}</h4>
                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-3">{stepItem.description}</p>
                </div>
                <div className="text-[10px] text-slate-400 font-medium mt-3 pt-2 border-t border-amber-50 flex justify-between items-center">
                  <span>Estimasi: {stepItem.durationEst}</span>
                  <ChevronRight className="h-3 w-3 text-slate-300" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4">Status Sertipikat</h3>
            <div className="h-56">
              {statusPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} Kavling`, 'Jumlah']} />
                    <Legend verticalAlign="bottom" height={36} iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">Belum ada data</div>
              )}
            </div>
          </div>
          <div className="bg-slate-50 p-3 rounded-2xl text-[10px] text-slate-500 flex items-start gap-1.5 mt-2">
            <Info className="h-3.5 w-3.5 text-pastel-blue shrink-0 mt-0.5" />
            <span>Warna status: Hijau (Sudah Terbit), Kuning (Sedang Proses), Merah (Belum Diajukan). Klik kategori untuk memfilter langsung.</span>
          </div>
        </div>

        {/* Frekuensi Kendala Kategori */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4">Frekuensi Kendala Pertanahan</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kendalaChartData}>
                <XAxis dataKey="name" stroke="#888888" fontSize={9} tickLine={false} />
                <YAxis stroke="#888888" fontSize={9} tickLine={false} />
                <Tooltip formatter={(value) => [`${value} Kavling`, 'Kavling']} />
                <Bar dataKey="Kavling" radius={[4, 4, 0, 0]}>
                  {kendalaChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-slate-50 p-3 rounded-2xl text-[10px] text-slate-500 flex items-start gap-1.5 mt-2">
            <Info className="h-3.5 w-3.5 text-pastel-blue shrink-0 mt-0.5" />
            <span>Menunjukkan jumlah kavling berdasarkan kendala alas hak asal (SHP, SHM, LC, Overlap/Tumpang Tindih).</span>
          </div>
        </div>

        {/* Kecamatan Sebaran */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4">Top 5 Sebaran Kecamatan</h3>
          <div className="h-56">
            {kecChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kecChartData}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={9} tickLine={false} />
                  <YAxis stroke="#888888" fontSize={9} tickLine={false} />
                  <Tooltip wrapperStyle={{ fontSize: '11px' }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="Total Penerima" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Sertipikat Selesai" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">Belum ada data</div>
            )}
          </div>
        </div>

        {/* Blok Comparison */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4">Per Blok: Total vs Sudah Sertipikat</h3>
          <div className="h-56">
            {blokChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={blokChartData}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={9} tickLine={false} />
                  <YAxis stroke="#888888" fontSize={9} tickLine={false} />
                  <Tooltip wrapperStyle={{ fontSize: '11px' }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="Total Kavling" fill="#f97316" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Sudah Sertipikat" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">Belum ada data</div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Summary Banner */}
      <div className="bg-orange-50 border border-orange-200 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 bg-orange-100 text-orange-700 rounded-2xl shrink-0">
            <Award className="h-5 w-5" />
          </span>
          <div>
            <h4 className="font-extrabold text-stone-900 text-xs uppercase tracking-wider">Status Kelengkapan SK Penerima</h4>
            <p className="text-xs text-stone-600 mt-1">
              Data penghuni terdaftar yang belum masuk dalam daftar SK Bupati (Hasil dari jumlah seluruh hunian terdaftar dikurangi kuota dalam SK).
            </p>
          </div>
        </div>
        <div className="bg-orange-600 text-white px-5 py-2.5 rounded-full text-xs font-black shrink-0 shadow-sm">
          Belum SK: {belumSKCount}
        </div>
      </div>
    </div>
  );
}
