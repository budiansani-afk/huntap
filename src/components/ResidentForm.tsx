/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, User, FileText, Camera, Save, Undo, Smartphone, Ruler, 
  Hash, HelpCircle, Activity, FileCheck, Check, Upload, Loader2, AlertCircle 
} from 'lucide-react';
import { Resident, CERTIFICATION_STEPS } from '../types';
import { uploadFile } from '../cloudinary';

interface ResidentFormProps {
  editingResident: Resident | null;
  onSave: (resident: Omit<Resident, 'lastUpdated' | 'updatedBy'>) => void;
  onCancel: () => void;
  currentUser: string;
  residents: Resident[];
}

export default function ResidentForm({ editingResident, onSave, onCancel, currentUser, residents = [] }: ResidentFormProps) {
  const [nomorRumah, setNomorRumah] = useState('');
  const [nama, setNama] = useState('');
  const [nik, setNik] = useState('');
  const [noKk, setNoKk] = useState('');
  const [desa, setDesa] = useState('');
  const [kecamatan, setKecamatan] = useState('');
  const [luas, setLuas] = useState<number | ''>('');
  const [dokumenTanah, setDokumenTanah] = useState('');
  const [terimaSertipikat, setTerimaSertipikat] = useState<'Sudah' | 'Belum' | 'Sedang Proses'>('Belum');
  const [noHp, setNoHp] = useState('');
  const [koordinat, setKoordinat] = useState('');
  const [catatanPetugas, setCatatanPetugas] = useState('');
  const [progressStep, setProgressStep] = useState(1);

  // File Upload States
  const [fotoRumah, setFotoRumah] = useState<string>('');
  const [fotoKtpKk, setFotoKtpKk] = useState<string>('');
  const [unggahDokTanah, setUnggahDokTanah] = useState<string>('');
  const [fotoShm, setFotoShm] = useState<string>('');

  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Refs for file input
  const fileInputRumah = useRef<HTMLInputElement>(null);
  const fileInputKtp = useRef<HTMLInputElement>(null);
  const fileInputDok = useRef<HTMLInputElement>(null);
  const fileInputShm = useRef<HTMLInputElement>(null);

  // Populate form if in edit mode
  useEffect(() => {
    if (editingResident) {
      setNomorRumah(editingResident.nomorRumah || '');
      setNama(editingResident.nama || '');
      setNik(editingResident.nik || '');
      setNoKk(editingResident.noKk || '');
      setDesa(editingResident.desa || '');
      setKecamatan(editingResident.kecamatan || '');
      setLuas(editingResident.luas || '');
      setDokumenTanah(editingResident.dokumenTanah || '');
      setTerimaSertipikat(editingResident.terimaSertipikat || 'Belum');
      setNoHp(editingResident.noHp || '');
      setKoordinat(editingResident.koordinat || '');
      setCatatanPetugas(editingResident.catatanPetugas || '');
      setProgressStep(editingResident.progressStep || 1);
      setFotoRumah(editingResident.fotoRumah || '');
      setFotoKtpKk(editingResident.fotoKtpKk || '');
      setUnggahDokTanah(editingResident.unggahDokTanah || '');
      setFotoShm(editingResident.fotoShm || '');
    } else {
      resetForm();
    }
  }, [editingResident]);

  const resetForm = () => {
    setNomorRumah('');
    setNama('');
    setNik('');
    setNoKk('');
    setDesa('');
    setKecamatan('');
    setLuas('');
    setDokumenTanah('');
    setTerimaSertipikat('Belum');
    setNoHp('');
    setKoordinat('');
    setCatatanPetugas('');
    setProgressStep(1);
    setFotoRumah('');
    setFotoKtpKk('');
    setUnggahDokTanah('');
    setFotoShm('');
    setErrorMsg('');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate is image
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Hanya file gambar yang didukung untuk dokumentasi');
      return;
    }

    setUploadingField(fieldName);
    setErrorMsg('');

    try {
      const uploadUrl = await uploadFile(file, `huntap_docs_${fieldName}`);
      if (fieldName === 'fotoRumah') setFotoRumah(uploadUrl);
      if (fieldName === 'fotoKtpKk') setFotoKtpKk(uploadUrl);
      if (fieldName === 'unggahDokTanah') setUnggahDokTanah(uploadUrl);
      if (fieldName === 'fotoShm') setFotoShm(uploadUrl);
    } catch (err: any) {
      setErrorMsg(`Gagal mengunggah file: ${err.message || err}`);
    } finally {
      setUploadingField(null);
    }
  };

  const handleAutoCoordinate = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude.toFixed(6);
          const lng = position.coords.longitude.toFixed(6);
          setKoordinat(`${lat},${lng}`);
        },
        (error) => {
          setErrorMsg('Gagal mendeteksi lokasi otomatis. Mohon ketik manual.');
        }
      );
    } else {
      setErrorMsg('Fitur GPS tidak didukung oleh browser ini.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Field Validations
    if (!nomorRumah.trim()) {
      setErrorMsg('Nomor rumah wajib diisi!');
      return;
    }
    if (!nama.trim()) {
      setErrorMsg('Nama kepala keluarga wajib diisi!');
      return;
    }
    if (nik && nik.length !== 16) {
      setErrorMsg('NIK harus terdiri dari 16 digit angka!');
      return;
    }
    if (noKk && noKk.length !== 16) {
      setErrorMsg('Nomor KK harus terdiri dari 16 digit angka!');
      return;
    }

    // Duplicate Validation
    const normalizedNomorRumah = nomorRumah.trim().toUpperCase();
    const normalizedNik = nik.trim();

    // 1. Check for duplicate Nomor Rumah
    const duplicateNomorRumah = residents.find(r => 
      r.nomorRumah && r.nomorRumah.toUpperCase() === normalizedNomorRumah && 
      (!editingResident || r.id !== editingResident.id)
    );

    if (duplicateNomorRumah) {
      setErrorMsg(`Peringatan: Nomor Rumah "${normalizedNomorRumah}" sudah terdaftar atas nama "${duplicateNomorRumah.nama}"! Silakan periksa kembali.`);
      return;
    }

    // 2. Check for duplicate NIK (KTP)
    if (normalizedNik) {
      const duplicateNik = residents.find(r => 
        r.nik === normalizedNik && 
        (!editingResident || r.id !== editingResident.id)
      );

      if (duplicateNik) {
        setErrorMsg(`Peringatan: Nomor KTP / NIK "${normalizedNik}" sudah terdaftar atas nama "${duplicateNik.nama}" di Unit Rumah "${duplicateNik.nomorRumah || '-'}"!`);
        return;
      }
    }

    const itemData: Omit<Resident, 'lastUpdated' | 'updatedBy'> = {
      id: editingResident ? editingResident.id : Date.now().toString(),
      nomorRumah: nomorRumah.trim().toUpperCase(),
      nama: nama.trim(),
      nik: nik.trim(),
      noKk: noKk.trim(),
      desa: desa.trim(),
      kecamatan: kecamatan,
      luas: luas ? Number(luas) : 0,
      dokumenTanah: dokumenTanah.trim(),
      terimaSertipikat,
      noHp: noHp.trim(),
      koordinat: koordinat.trim(),
      fotoRumah,
      fotoKtpKk,
      unggahDokTanah,
      fotoShm,
      progressStep,
      catatanPetugas: catatanPetugas.trim()
    };

    onSave(itemData);
    resetForm();
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xs max-w-4xl mx-auto">
      <div className="px-6 py-4 bg-pastel-brown-light border-b border-orange-100 rounded-t-3xl flex justify-between items-center">
        <div className="flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-pastel-orange" />
          <h3 className="font-bold text-slate-800">
            {editingResident ? `Ubah Data: ${editingResident.nama} (${editingResident.nomorRumah})` : 'Tambah Data Penerima Huntap Baru'}
          </h3>
        </div>
        <span className="text-xs bg-white border border-orange-100 px-3 py-1 rounded-full font-semibold text-pastel-orange shadow-xs">
          Petugas: {currentUser}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {errorMsg && (
          <div className="bg-rose-50 text-rose-700 p-4 rounded-2xl border border-rose-100 text-sm flex items-start gap-2">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. Data Kependudukan & Rumah */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1">
            I. Identitas Kependudukan & Unit Hunian
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <Hash className="h-3.5 w-3.5 text-pastel-blue" /> No. Rumah Huntap *
              </label>
              <input 
                type="text" 
                value={nomorRumah}
                onChange={(e) => setNomorRumah(e.target.value)}
                placeholder="Contoh: A.01"
                className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-semibold uppercase"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-pastel-blue" /> Nama Kepala Keluarga *
              </label>
              <input 
                type="text" 
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Nama Lengkap Sesuai KTP"
                className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-semibold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600">NIK (Nomor Induk Kependudukan)</label>
              <input 
                type="text" 
                maxLength={16}
                value={nik}
                onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))}
                placeholder="16 Digit NIK"
                className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-mono tracking-wider"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600">No. Kartu Keluarga (KK)</label>
              <input 
                type="text" 
                maxLength={16}
                value={noKk}
                onChange={(e) => setNoKk(e.target.value.replace(/\D/g, ''))}
                placeholder="16 Digit No. KK"
                className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-mono tracking-wider"
              />
            </div>
          </div>
        </div>

        {/* 2. Lokasi & Wilayah */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1">
            II. Wilayah & Batas Bidang Tanah
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600">Desa Asal / Lokasi</label>
              <input 
                type="text" 
                value={desa}
                onChange={(e) => setDesa(e.target.value)}
                placeholder="Contoh: Tambe"
                className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-semibold"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600">Kecamatan Asal</label>
              <select 
                value={kecamatan}
                onChange={(e) => setKecamatan(e.target.value)}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-semibold"
              >
                <option value="">-- Pilih Kecamatan --</option>
                <option value="Bolo">Bolo</option>
                <option value="Wawo">Wawo</option>
                <option value="Donggo">Donggo</option>
                <option value="Madapangga">Madapangga</option>
                <option value="Tambora">Tambora</option>
                <option value="Sape">Sape</option>
                <option value="Monta">Monta</option>
                <option value="Woha">Woha</option>
                <option value="Lambu">Lambu</option>
                <option value="Langgudu">Langgudu</option>
                <option value="Belo">Belo</option>
                <option value="Ambalawi">Ambalawi</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <Ruler className="h-3.5 w-3.5 text-pastel-blue" /> Luas Kavling Tanah (m²)
              </label>
              <input 
                type="number" 
                value={luas}
                onChange={(e) => setLuas(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Luas dalam m2"
                className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <Smartphone className="h-3.5 w-3.5 text-pastel-blue" /> No. HP Aktif / WhatsApp
              </label>
              <input 
                type="text" 
                value={noHp}
                onChange={(e) => setNoHp(e.target.value)}
                placeholder="Contoh: 08123456789"
                className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-semibold"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-pastel-blue" /> Koordinat Lokasi (Lat, Lng)
                </span>
                <button 
                  type="button" 
                  onClick={handleAutoCoordinate}
                  className="text-[10px] text-pastel-blue hover:underline font-bold"
                >
                  GPS Otomatis
                </button>
              </label>
              <input 
                type="text" 
                value={koordinat}
                onChange={(e) => setKoordinat(e.target.value)}
                placeholder="Contoh: -8.4419,118.6253"
                className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-mono"
              />
            </div>
          </div>
        </div>

        {/* 3. Status Dokumen & Sertipikat (Fokus Transparansi) */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1">
            III. Status Sertipikasi & Dokumen Tanah Asal
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-pastel-blue" /> Alas Hak / Dokumen Tanah Asal
              </label>
              <input 
                type="text" 
                value={dokumenTanah}
                onChange={(e) => setDokumenTanah(e.target.value)}
                placeholder="SK/SHP/SHM Asal/LC dll."
                className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-semibold"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600">Status Sertipikat Tanah Huntap</label>
              <select 
                value={terimaSertipikat}
                onChange={(e) => setTerimaSertipikat(e.target.value as any)}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-semibold"
              >
                <option value="Belum">Belum Terbit (Diajukan)</option>
                <option value="Sedang Proses">Sedang Diproses (BPN)</option>
                <option value="Sudah">Sudah Terbit (Selesai)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <Activity className="h-3.5 w-3.5 text-pastel-blue" /> Tahapan Progress BPN
              </label>
              <select 
                value={progressStep}
                onChange={(e) => setProgressStep(Number(e.target.value))}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-semibold"
              >
                {CERTIFICATION_STEPS.map((step) => (
                  <option key={step.step} value={step.step}>
                    Tahap {step.step}: {step.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600">Catatan/Keterangan Proses Sertipikasi</label>
            <textarea 
              rows={3}
              value={catatanPetugas}
              onChange={(e) => setCatatanPetugas(e.target.value)}
              placeholder="Catatan verifikator BPN, kendala berkas, atau sengketa batas..."
              className="px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 text-sm"
            />
          </div>
        </div>

        {/* 4. Dokumentasi Foto (Cloudinary Integrated with Fallbacks) */}
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-1">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              IV. Berkas Dokumentasi & Foto Lapangan
            </h4>
            <span className="text-[10px] text-slate-400">Terintegrasi Cloudinary & Storage</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Foto Rumah & Penghuni */}
            <div className="p-4 bg-pastel-brown-light/40 border border-orange-50 rounded-2xl flex flex-col justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  📸 Foto Rumah / Penghuni
                </label>
                <p className="text-[10px] text-slate-500 mt-0.5">Dokumentasi fisik bangunan</p>
              </div>

              {fotoRumah ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-100 aspect-video">
                  <img src={fotoRumah} alt="Foto Rumah" className="w-full h-full object-cover" />
                  <button 
                    type="button" 
                    onClick={() => setFotoRumah('')}
                    className="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-full text-xs font-bold"
                  >
                    &times;
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRumah.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-pastel-blue rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition py-6 text-slate-400 hover:text-pastel-blue bg-white"
                >
                  {uploadingField === 'fotoRumah' ? (
                    <Loader2 className="h-5 w-5 animate-spin text-pastel-blue" />
                  ) : (
                    <>
                      <Upload className="h-5 w-5 mb-1" />
                      <span className="text-[10px] font-bold">Pilih / Ambil Foto</span>
                    </>
                  )}
                </div>
              )}
              <input 
                ref={fileInputRumah}
                type="file" 
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'fotoRumah')}
                className="hidden" 
              />
            </div>

            {/* Foto KTP / KK */}
            <div className="p-4 bg-pastel-brown-light/40 border border-orange-50 rounded-2xl flex flex-col justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  🪪 Foto KTP / Kartu Keluarga
                </label>
                <p className="text-[10px] text-slate-500 mt-0.5">Berkas identitas penduduk</p>
              </div>

              {fotoKtpKk ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-100 aspect-video">
                  <img src={fotoKtpKk} alt="Foto KTP/KK" className="w-full h-full object-cover" />
                  <button 
                    type="button" 
                    onClick={() => setFotoKtpKk('')}
                    className="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-full text-xs font-bold"
                  >
                    &times;
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputKtp.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-pastel-blue rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition py-6 text-slate-400 hover:text-pastel-blue bg-white"
                >
                  {uploadingField === 'fotoKtpKk' ? (
                    <Loader2 className="h-5 w-5 animate-spin text-pastel-blue" />
                  ) : (
                    <>
                      <Upload className="h-5 w-5 mb-1" />
                      <span className="text-[10px] font-bold">Pilih / Ambil Foto</span>
                    </>
                  )}
                </div>
              )}
              <input 
                ref={fileInputKtp}
                type="file" 
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'fotoKtpKk')}
                className="hidden" 
              />
            </div>

            {/* Unggah Dokumen Tanah Asal */}
            <div className="p-4 bg-pastel-brown-light/40 border border-orange-50 rounded-2xl flex flex-col justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  📄 Berkas Alas Hak / SK Asal
                </label>
                <p className="text-[10px] text-slate-500 mt-0.5">Dokumen hak awal pemilikan</p>
              </div>

              {unggahDokTanah ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-100 aspect-video">
                  <img src={unggahDokTanah} alt="Alas Hak" className="w-full h-full object-cover" />
                  <button 
                    type="button" 
                    onClick={() => setUnggahDokTanah('')}
                    className="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-full text-xs font-bold"
                  >
                    &times;
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputDok.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-pastel-blue rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition py-6 text-slate-400 hover:text-pastel-blue bg-white"
                >
                  {uploadingField === 'unggahDokTanah' ? (
                    <Loader2 className="h-5 w-5 animate-spin text-pastel-blue" />
                  ) : (
                    <>
                      <Upload className="h-5 w-5 mb-1" />
                      <span className="text-[10px] font-bold">Pilih / Ambil Foto</span>
                    </>
                  )}
                </div>
              )}
              <input 
                ref={fileInputDok}
                type="file" 
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'unggahDokTanah')}
                className="hidden" 
              />
            </div>

            {/* Foto SHM Baru / Lama */}
            <div className="p-4 bg-pastel-brown-light/40 border border-orange-50 rounded-2xl flex flex-col justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  🏆 Foto Sertipikat Terbit (SHM)
                </label>
                <p className="text-[10px] text-slate-500 mt-0.5">Dokumen cetak SHM akhir</p>
              </div>

              {fotoShm ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-100 aspect-video">
                  <img src={fotoShm} alt="Foto SHM" className="w-full h-full object-cover" />
                  <button 
                    type="button" 
                    onClick={() => setFotoShm('')}
                    className="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-full text-xs font-bold"
                  >
                    &times;
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputShm.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-pastel-blue rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition py-6 text-slate-400 hover:text-pastel-blue bg-white"
                >
                  {uploadingField === 'fotoShm' ? (
                    <Loader2 className="h-5 w-5 animate-spin text-pastel-blue" />
                  ) : (
                    <>
                      <Upload className="h-5 w-5 mb-1" />
                      <span className="text-[10px] font-bold">Pilih / Ambil Foto</span>
                    </>
                  )}
                </div>
              )}
              <input 
                ref={fileInputShm}
                type="file" 
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'fotoShm')}
                className="hidden" 
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onCancel}
            className="px-5 py-2.5 rounded-full border border-slate-200 font-bold text-slate-500 hover:bg-slate-50 transition text-sm flex items-center gap-1.5"
          >
            <Undo className="h-4 w-4" /> Batal
          </button>
          <button 
            type="submit"
            className="px-6 py-2.5 rounded-full bg-pastel-blue text-white font-bold hover:bg-blue-600 transition shadow-sm hover:shadow-md text-sm flex items-center gap-1.5"
          >
            <Save className="h-4 w-4" /> Simpan Data
          </button>
        </div>
      </form>
    </div>
  );
}
