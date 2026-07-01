/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Resident {
  id: string;
  nomorRumah: string; // e.g., A.01, B.04
  nama: string; // Kepala Keluarga
  nik: string; // NIK
  noKk: string; // Nomor KK
  desa: string;
  kecamatan: string;
  luas: number; // Luas Tanah (m2)
  dokumenTanah: string; // SK / SHP / SHM / LC / Alas Hak
  terimaSertipikat: 'Sudah' | 'Belum' | 'Sedang Proses';
  noHp: string;
  koordinat: string; // "lat,lng"
  fotoRumah?: string; // URL
  fotoKtpKk?: string; // URL
  unggahDokTanah?: string; // URL
  fotoShm?: string; // URL
  progressStep: number; // 1 to 5
  lastUpdated: string;
  updatedBy: string;
  catatanPetugas?: string;
  keterangan?: string;
}

export interface AuditLog {
  id: string;
  tanggal: string;
  jam: string;
  pengguna: string;
  role: string;
  aktivitas: string; // 'Login' | 'Tambah Data' | 'Edit Data' | 'Hapus Data' | 'Update Progress' | 'Import Excel' | 'Export Excel'
  nomorRumah: string;
  namaPenerima: string;
  keterangan: string;
  dataSebelum?: string | null;
  dataSesudah?: string | null;
  status: 'Berhasil' | 'Gagal';
  timestamp: string;
}

export type UserRole = 'Admin' | 'Kantor Pertanahan' | 'Surveyor' | 'Warga';

export interface AppUser {
  username: string;
  role: UserRole;
  namaLengkap: string;
  nik?: string; // For role 'Warga' to map to their resident data
  password?: string; // Kata sandi untuk login
}

export interface LandCertificationStep {
  step: number;
  label: string;
  description: string;
  durationEst: string; // Estimated duration
  icon: string;
}

export const CERTIFICATION_STEPS: LandCertificationStep[] = [
  {
    step: 1,
    label: 'Pengajuan & Verifikasi Berkas',
    description: 'Pendaftaran berkas alas hak/SK/SHP asal dan dokumen kependudukan ke Kantor Pertanahan.',
    durationEst: '3-5 Hari',
    icon: 'FileText'
  },
  {
    step: 2,
    label: 'Pengukuran Bidang Tanah',
    description: 'Petugas ukur melakukan pengukuran fisik batas-batas kavling hunian di lapangan.',
    durationEst: '5-7 Hari',
    icon: 'Ruler'
  },
  {
    step: 3,
    label: 'Sidang Panitia Pemeriksa Tanah A',
    description: 'Pemeriksaan aspek yuridis, kepemilikan, dan batas tanah oleh Panitia A Kantor Pertanahan.',
    durationEst: '7-10 Hari',
    icon: 'Users'
  },
  {
    step: 4,
    label: 'Penerbitan SK Hak & Pembukuan',
    description: 'Penerbitan Surat Keputusan Pemberian Hak Atas Tanah dan pencatatan buku tanah BPN.',
    durationEst: '5-7 Hari',
    icon: 'Award'
  },
  {
    step: 5,
    label: 'Pencetakan & Penyerahan Sertipikat',
    description: 'Pencetakan Sertipikat Hak Milik (SHM) Hunian Tetap dan penyerahan resmi kepada warga.',
    durationEst: '2-3 Hari',
    icon: 'Home'
  }
];

export interface AppToast {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  aktivitas?: string;
  user?: string;
  timestamp: number;
}
