/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Building, CheckCircle, Clock, ArrowRight, Search, FileText, AlertTriangle, 
  Send, Plus, ShieldCheck, Check, Loader2, Award, Users, Ruler, Home, Landmark 
} from 'lucide-react';
import { Resident, CERTIFICATION_STEPS, AppUser } from '../types';
import { uploadFile } from '../cloudinary';

interface LandOfficePanelProps {
  residents: Resident[];
  currentUser: AppUser;
  onUpdateResidentProgress: (id: string, step: number, status: 'Sudah' | 'Belum' | 'Sedang Proses', notes: string) => void;
  onSubmitNewApplication: (application: Omit<Resident, 'lastUpdated' | 'updatedBy'>) => void;
}

export default function LandOfficePanel({ 
  residents, 
  currentUser, 
  onUpdateResidentProgress,
  onSubmitNewApplication
}: LandOfficePanelProps) {
  const isBPN = currentUser.role === 'Kantor Pertanahan' || currentUser.role === 'Admin';
  const isResident = currentUser.role === 'Warga';

  // ----------------------------------------------------
  // RESIDENT ROLE WORKFLOW (SUBMIT APPLICATION / TRACK STATUS)
  // ----------------------------------------------------
  
  // Track resident's matching unit
  const myResidentData = useMemo(() => {
    if (currentUser.role === 'Warga' && currentUser.nik) {
      return residents.find(r => r.nik === currentUser.nik || r.nama.toLowerCase().includes(currentUser.username.toLowerCase()));
    }
    return null;
  }, [residents, currentUser]);

  // Submit new application state (for residents whose house is not registered)
  const [newNomorRumah, setNewNomorRumah] = useState('');
  const [newNama, setNewNama] = useState(currentUser.namaLengkap);
  const [newNik, setNewNik] = useState(currentUser.nik || '');
  const [newNoKk, setNewNoKk] = useState('');
  const [newDesa, setNewDesa] = useState('Tambe');
  const [newLuas, setNewLuas] = useState<number | ''>('');
  const [newDokumenTanah, setNewDokumenTanah] = useState('SK Bupati No. 188/2021');
  const [newNoHp, setNewNoHp] = useState('');
  const [newKoordinat, setNewKoordinat] = useState('');
  const [newFotoRumah, setNewFotoRumah] = useState('');
  const [newFotoKtp, setNewFotoKtp] = useState('');
  const [newAlasHak, setNewAlasHak] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleResidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setErrorMsg('');

    if (!newNomorRumah) {
      setErrorMsg('Nomor Rumah unit wajib diisi!');
      return;
    }
    if (!newNama) {
      setErrorMsg('Nama Kepala Keluarga wajib diisi!');
      return;
    }

    setSubmitting(true);
    try {
      const appData: Omit<Resident, 'lastUpdated' | 'updatedBy'> = {
        id: `resident-app-${Date.now()}`,
        nomorRumah: newNomorRumah.toUpperCase().trim(),
        nama: newNama.trim(),
        nik: newNik.trim(),
        noKk: newNoKk.trim(),
        desa: newDesa.trim(),
        kecamatan: 'Bolo',
        luas: newLuas ? Number(newLuas) : 120,
        dokumenTanah: newDokumenTanah.trim(),
        terimaSertipikat: 'Belum',
        noHp: newNoHp.trim(),
        koordinat: newKoordinat.trim(),
        fotoRumah: newFotoRumah,
        fotoKtpKk: newFotoKtp,
        unggahDokTanah: newAlasHak,
        progressStep: 1,
        catatanPetugas: 'Berkas baru diajukan secara online oleh warga. Menunggu verifikasi berkas fisik Kantor Pertanahan.'
      };

      onSubmitNewApplication(appData);
      setMsg('Pengajuan Berkas Sertipikasi berhasil terkirim ke Kantor Pertanahan Bima! Mohon pantau status berkas Anda di bawah.');
      
      // Reset form
      setNewNomorRumah('');
      setNewNoKk('');
      setNewLuas('');
      setNewNoHp('');
      setNewKoordinat('');
      setNewFotoRumah('');
      setNewFotoKtp('');
      setNewAlasHak('');
    } catch (err: any) {
      setErrorMsg(`Gagal mengirim pengajuan: ${err.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Upload helpers for resident form
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setMsg(`Mengunggah foto ${field}...`);
      const url = await uploadFile(file, `res_submissions_${field}`);
      setter(url);
      setMsg(`Foto ${field} berhasil terunggah!`);
    } catch (error) {
      setErrorMsg(`Gagal mengunggah foto ${field}`);
    }
  };


  // ----------------------------------------------------
  // BPN / LAND OFFICE / ADMIN ROLE WORKFLOW
  // ----------------------------------------------------
  const [bpnSearch, setBpnSearch] = useState('');
  const [selectedBpnResident, setSelectedBpnResident] = useState<Resident | null>(null);
  const [updateStep, setUpdateStep] = useState(1);
  const [updateStatus, setUpdateStatus] = useState<'Sudah' | 'Belum' | 'Sedang Proses'>('Belum');
  const [updateNotes, setUpdateNotes] = useState('');
  const [updateSuccessMsg, setUpdateSuccessMsg] = useState('');

  // Synchronize dropdown when selecting a resident
  const handleSelectBpnResident = (r: Resident) => {
    setSelectedBpnResident(r);
    setUpdateStep(r.progressStep || 1);
    setUpdateStatus(r.terimaSertipikat || 'Belum');
    setUpdateNotes(r.catatanPetugas || '');
    setUpdateSuccessMsg('');
  };

  const handleSaveProgressUpdate = () => {
    if (!selectedBpnResident) return;

    onUpdateResidentProgress(
      selectedBpnResident.id,
      updateStep,
      updateStatus,
      updateNotes
    );

    setUpdateSuccessMsg('Progress Sertipikasi Tanah berhasil diperbarui secara real-time!');
    
    // Update local state
    const updated = {
      ...selectedBpnResident,
      progressStep: updateStep,
      terimaSertipikat: updateStatus,
      catatanPetugas: updateNotes
    };
    setSelectedBpnResident(updated);

    setTimeout(() => {
      setUpdateSuccessMsg('');
    }, 4000);
  };

  // Filter pending or active process cases for BPN
  const bpnFilteredList = useMemo(() => {
    return residents.filter(r => {
      const q = bpnSearch.toLowerCase();
      const num = r.nomorRumah.toLowerCase();
      const name = r.nama.toLowerCase();
      return num.includes(q) || name.includes(q);
    });
  }, [residents, bpnSearch]);


  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-3">
        <div className="p-3 bg-pastel-orange-light rounded-2xl text-pastel-orange shadow-xs">
          <Building className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-base font-black text-slate-800">Layanan Pertanahan & Sertipikasi</h2>
          <p className="text-xs text-slate-500">
            Fasilitasi integrasi pengajuan alas hak hunian tetap dengan Kantor Pertanahan Kabupaten Bima.
          </p>
        </div>
      </div>

      {/* ----------------- WARGA/RESIDENT VIEW ----------------- */}
      {isResident && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Track existing progress of my unit */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-5">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                <ShieldCheck className="h-5 w-5 text-green-600" /> Tracking Sertipikat Unit Anda
              </h3>

              {myResidentData ? (
                <div className="space-y-6">
                  {/* Summary row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-pastel-blue-light/45 rounded-2xl border border-blue-50">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">No. Rumah</div>
                      <div className="text-sm font-black text-pastel-blue-dark">{myResidentData.nomorRumah}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Nama Kepala Keluarga</div>
                      <div className="text-sm font-black text-slate-800">{myResidentData.nama}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Alas Hak Asal</div>
                      <div className="text-xs font-bold text-slate-600">{myResidentData.dokumenTanah}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Status SHM</div>
                      <span className={`inline-block px-2.5 py-0.5 mt-0.5 rounded-full text-[9px] font-bold ${myResidentData.terimaSertipikat === 'Sudah' ? 'bg-emerald-100 text-emerald-800' : (myResidentData.terimaSertipikat === 'Sedang Proses' ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800')}`}>
                        {myResidentData.terimaSertipikat === 'Sudah' ? 'Sertipikat Terbit' : (myResidentData.terimaSertipikat === 'Sedang Proses' ? 'Sedang Diproses' : 'Belum Diajukan')}
                      </span>
                    </div>
                  </div>

                  {/* Progressive flow timeline */}
                  <div className="space-y-4 pt-2">
                    <h4 className="text-xs font-bold text-slate-700">Tahapan Sertipikasi di BPN Bima:</h4>
                    
                    <div className="relative border-l-2 border-slate-200 pl-6 ml-3 space-y-6">
                      {CERTIFICATION_STEPS.map((step) => {
                        const isDone = step.step < myResidentData.progressStep;
                        const isCurrent = step.step === myResidentData.progressStep;
                        const isFuture = step.step > myResidentData.progressStep;

                        let bulletBg = 'bg-slate-100 border-slate-300 text-slate-400';
                        let textColor = 'text-slate-400';
                        if (isDone) {
                          bulletBg = 'bg-green-100 border-green-500 text-green-600';
                          textColor = 'text-slate-700 font-semibold';
                        } else if (isCurrent) {
                          bulletBg = 'bg-pastel-blue text-white ring-4 ring-blue-100 border-pastel-blue';
                          textColor = 'text-slate-800 font-extrabold';
                        }

                        return (
                          <div key={step.step} className="relative">
                            {/* Absolute Positioning bullet indicator */}
                            <span className={`absolute -left-[31px] top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${bulletBg}`}>
                              {isDone ? '✓' : step.step}
                            </span>
                            
                            <div>
                              <div className="flex items-center gap-2">
                                <h5 className={`text-xs ${textColor}`}>{step.label}</h5>
                                {isCurrent && (
                                  <span className="bg-pastel-orange text-white text-[8px] font-black px-1.5 py-0.5 rounded-full animate-pulse uppercase">
                                    Tahapan Aktif
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 mt-1">{step.description}</p>
                              {isCurrent && (
                                <div className="text-[10px] text-slate-400 mt-0.5 font-bold">Estimasi Selesai: {step.durationEst}</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Official Notes from Verifier */}
                  {myResidentData.catatanPetugas && (
                    <div className="p-4 bg-orange-50/60 rounded-2xl border border-orange-100">
                      <div className="text-[10px] font-black text-pastel-orange-dark uppercase mb-1">Catatan Verifikator Kantor Pertanahan</div>
                      <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                        {myResidentData.catatanPetugas}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-10 space-y-3">
                  <AlertTriangle className="h-10 w-10 text-pastel-yellow mx-auto" />
                  <div className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Data kependudukan / NIK Anda belum terdaftar di basis data hunian tetap Desa Tambe. 
                    Silakan gunakan formulir di samping kanan untuk <strong>Mengajukan Berkas Sertipikasi</strong> secara mandiri ke Kantor Pertanahan.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* New submission form for residents */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <FileText className="h-5 w-5 text-pastel-orange" /> Ajukan Berkas Sertipikat
              </h3>

              {msg && <div className="bg-green-50 text-green-700 p-3.5 rounded-2xl text-xs font-semibold border border-green-100">{msg}</div>}
              {errorMsg && <div className="bg-rose-50 text-rose-700 p-3.5 rounded-2xl text-xs font-semibold border border-rose-100">{errorMsg}</div>}

              <form onSubmit={handleResidentSubmit} className="space-y-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-600">Nomor Rumah Huntap *</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: A.12" 
                    value={newNomorRumah}
                    onChange={(e) => setNewNomorRumah(e.target.value)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold uppercase"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-600">Nama Kepala Keluarga *</label>
                  <input 
                    type="text" 
                    value={newNama}
                    onChange={(e) => setNewNama(e.target.value)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-600">Nomor KK (Kartu Keluarga)</label>
                  <input 
                    type="text" 
                    maxLength={16}
                    placeholder="16 Digit No. KK"
                    value={newNoKk}
                    onChange={(e) => setNewNoKk(e.target.value.replace(/\D/g, ''))}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-600">Luas Tanah (m²)</label>
                  <input 
                    type="number" 
                    placeholder="Contoh: 120"
                    value={newLuas}
                    onChange={(e) => setNewLuas(e.target.value === '' ? '' : Number(e.target.value))}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-600">Alas Hak / Dokumen Tanah Asal</label>
                  <input 
                    type="text" 
                    value={newDokumenTanah}
                    onChange={(e) => setNewDokumenTanah(e.target.value)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-600">No. WhatsApp Aktif</label>
                  <input 
                    type="text" 
                    placeholder="08xxxxxxxxxx"
                    value={newNoHp}
                    onChange={(e) => setNewNoHp(e.target.value)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold"
                  />
                </div>

                {/* File Upload fields */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Unggah Bukti Pendukung</span>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[9px] font-bold text-slate-600 block mb-1">Foto KTP/KK</label>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleFileChange(e, setNewFotoKtp, 'KTP')}
                        className="text-[9px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[9px] file:font-semibold file:bg-blue-50 file:text-blue-700 cursor-pointer" 
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-600 block mb-1">Alas Hak</label>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleFileChange(e, setNewAlasHak, 'AlasHak')}
                        className="text-[9px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[9px] file:font-semibold file:bg-blue-50 file:text-blue-700 cursor-pointer" 
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-600 block mb-1">Foto Rumah</label>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleFileChange(e, setNewFotoRumah, 'Rumah')}
                        className="text-[9px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[9px] file:font-semibold file:bg-blue-50 file:text-blue-700 cursor-pointer" 
                      />
                    </div>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full py-2.5 mt-3 rounded-full bg-pastel-blue text-white font-bold text-xs hover:bg-blue-600 transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" /> Kirim Pengajuan Berkas
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- BPN / ADMINISTRATOR VIEW ----------------- */}
      {isBPN && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Select resident and track details */}
          <div className="lg:col-span-1 bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4 max-h-[640px] overflow-y-auto">
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
              <Landmark className="h-5 w-5 text-pastel-orange" /> Pilih Kavling / Unit Huntap
            </h3>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Cari berdasarkan nomor atau nama..."
                value={bpnSearch}
                onChange={(e) => setBpnSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700 text-xs focus:bg-white"
              />
            </div>

            <div className="space-y-1.5 divide-y divide-slate-50 pt-1">
              {bpnFilteredList.length > 0 ? (
                bpnFilteredList.map((item) => {
                  const isSelected = selectedBpnResident?.id === item.id;
                  return (
                    <div 
                      key={item.id}
                      onClick={() => handleSelectBpnResident(item)}
                      className={`p-3 rounded-xl cursor-pointer transition flex items-center justify-between gap-2 ${isSelected ? 'bg-pastel-blue-light/50 border border-blue-100 shadow-xs' : 'hover:bg-slate-50'}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-pastel-blue-light text-pastel-blue-dark font-extrabold px-1.5 py-0.5 rounded text-[9px]">
                            {item.nomorRumah}
                          </span>
                          <span className="font-extrabold text-xs text-slate-800 line-clamp-1">{item.nama}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-semibold">{item.desa} - Alas: {item.dokumenTanah}</div>
                      </div>
                      
                      <div className="text-right flex flex-col items-end gap-1 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold border ${item.terimaSertipikat === 'Sudah' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : (item.terimaSertipikat === 'Sedang Proses' ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-yellow-50 text-yellow-700 border-yellow-100')}`}>
                          {item.terimaSertipikat}
                        </span>
                        <span className="text-[8px] text-slate-400 font-bold">Tahap {item.progressStep}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs">Unit tidak ditemukan</div>
              )}
            </div>
          </div>

          {/* Verification & Action controller */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-5">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                <ShieldCheck className="h-5 w-5 text-pastel-blue" /> Panel Verifikasi Kantor Pertanahan Bima
              </h3>

              {selectedBpnResident ? (
                <div className="space-y-6">
                  {/* Selected summary */}
                  <div className="p-4 bg-pastel-brown-light/40 border border-orange-100 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-pastel-blue text-white font-black px-2.5 py-0.5 rounded-lg text-xs">
                          {selectedBpnResident.nomorRumah}
                        </span>
                        <h4 className="font-extrabold text-slate-800 text-sm">{selectedBpnResident.nama}</h4>
                      </div>
                      <div className="text-[10px] text-slate-500 font-bold">
                        NIK: {selectedBpnResident.nik || '-'} | Luas: {selectedBpnResident.luas} m² | Dokumen: {selectedBpnResident.dokumenTanah}
                      </div>
                    </div>
                    
                    <div className="text-xs text-slate-500 flex flex-col md:items-end gap-0.5">
                      <span className="font-bold">Progress Terkini:</span>
                      <span className="bg-white border border-slate-200 px-3 py-1 rounded-full text-[10px] font-bold text-slate-700">
                        Tahap {selectedBpnResident.progressStep} : {CERTIFICATION_STEPS.find(s=>s.step === selectedBpnResident.progressStep)?.label}
                      </span>
                    </div>
                  </div>

                  {/* Document Upload Previews */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Kelengkapan Bukti / Berkas Digital</span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="border border-slate-100 rounded-xl p-2 bg-slate-50 text-center">
                        <span className="text-[9px] font-bold text-slate-400 block truncate">Foto KTP/KK</span>
                        {selectedBpnResident.fotoKtpKk ? (
                          <a href={selectedBpnResident.fotoKtpKk} target="_blank" rel="noreferrer" className="text-xs text-pastel-blue font-bold block mt-1 hover:underline">📷 Lihat</a>
                        ) : (
                          <span className="text-[9px] text-slate-300 block mt-1">Kosong</span>
                        )}
                      </div>

                      <div className="border border-slate-100 rounded-xl p-2 bg-slate-50 text-center">
                        <span className="text-[9px] font-bold text-slate-400 block truncate">Alas Hak Asal</span>
                        {selectedBpnResident.unggahDokTanah ? (
                          <a href={selectedBpnResident.unggahDokTanah} target="_blank" rel="noreferrer" className="text-xs text-pastel-blue font-bold block mt-1 hover:underline">📄 Lihat</a>
                        ) : (
                          <span className="text-[9px] text-slate-300 block mt-1">Kosong</span>
                        )}
                      </div>

                      <div className="border border-slate-100 rounded-xl p-2 bg-slate-50 text-center">
                        <span className="text-[9px] font-bold text-slate-400 block truncate">Foto Rumah</span>
                        {selectedBpnResident.fotoRumah ? (
                          <a href={selectedBpnResident.fotoRumah} target="_blank" rel="noreferrer" className="text-xs text-pastel-blue font-bold block mt-1 hover:underline">🏠 Lihat</a>
                        ) : (
                          <span className="text-[9px] text-slate-300 block mt-1">Kosong</span>
                        )}
                      </div>

                      <div className="border border-slate-100 rounded-xl p-2 bg-slate-50 text-center">
                        <span className="text-[9px] font-bold text-slate-400 block truncate">SHM Baru</span>
                        {selectedBpnResident.fotoShm ? (
                          <a href={selectedBpnResident.fotoShm} target="_blank" rel="noreferrer" className="text-xs text-pastel-blue font-bold block mt-1 hover:underline">🏆 Lihat</a>
                        ) : (
                          <span className="text-[9px] text-slate-300 block mt-1">Belum Terbit</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress Editor controller form */}
                  <div className="space-y-4 pt-3 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Pembaruan Tahapan Sertipikasi</span>
                    
                    {updateSuccessMsg && (
                      <div className="bg-emerald-50 text-emerald-700 border border-emerald-100 p-3.5 rounded-2xl text-xs font-bold flex items-center gap-1">
                        <Check className="h-4 w-4" /> {updateSuccessMsg}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-600">Lompat ke Tahapan BPN</label>
                        <select 
                          value={updateStep}
                          onChange={(e) => {
                            const stepNum = Number(e.target.value);
                            setUpdateStep(stepNum);
                            // Auto map status
                            if (stepNum === 5) {
                              setUpdateStatus('Sudah');
                            } else if (stepNum > 1) {
                              setUpdateStatus('Sedang Proses');
                            } else {
                              setUpdateStatus('Belum');
                            }
                          }}
                          className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:bg-white"
                        >
                          {CERTIFICATION_STEPS.map((s) => (
                            <option key={s.step} value={s.step}>
                              Tahap {s.step}: {s.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-600">Status Kelulusan</label>
                        <select 
                          value={updateStatus}
                          onChange={(e) => setUpdateStatus(e.target.value as any)}
                          className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:bg-white"
                        >
                          <option value="Belum">Belum Terbit (Diajukan)</option>
                          <option value="Sedang Proses">Sedang Diproses (Aktif)</option>
                          <option value="Sudah">Sudah Terbit / Selesai</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-600">Catatan Resmi Kantor Pertanahan</label>
                      <textarea 
                        rows={3}
                        value={updateNotes}
                        onChange={(e) => setUpdateNotes(e.target.value)}
                        placeholder="Masukkan catatan baru mengenai perkembangan berkas atau sengketa batas bidang..."
                        className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 focus:bg-white"
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button 
                        onClick={handleSaveProgressUpdate}
                        className="px-6 py-2.5 rounded-full bg-pastel-blue text-white font-bold text-xs hover:bg-blue-600 shadow-sm hover:shadow-md transition flex items-center gap-1"
                      >
                        <ShieldCheck className="h-4 w-4" /> Perbarui Progress Sekarang
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 space-y-3">
                  <Building className="h-12 w-12 text-slate-200 mx-auto" />
                  <div className="text-xs text-slate-400 font-bold">Silakan pilih salah satu unit/kavling di panel kiri untuk mulai memverifikasi berkas.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
