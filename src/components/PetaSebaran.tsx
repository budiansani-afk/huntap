/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  MapPin, Globe, Compass, Home, Layers, Check, Info, X, 
  User, Key, Phone, Ruler, Clock, Edit2
} from 'lucide-react';
import { Resident } from '../types';

interface PetaSebaranProps {
  residents: Resident[];
  locateResident: Resident | null;
  onClearLocate: () => void;
  onEdit?: (resident: Resident) => void;
  currentUserRole?: string;
}

export default function PetaSebaran({ 
  residents, 
  locateResident, 
  onClearLocate,
  onEdit,
  currentUserRole = 'Warga'
}: PetaSebaranProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const markersMapRef = useRef<Record<string, L.CircleMarker>>({});
  const hasInitialFitRef = useRef(false);
  const popupTimerRef = useRef<any>(null);
  const [activeTile, setActiveTile] = useState<'streets' | 'satellite'>('satellite');
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);

  // Coordinates of Bolo, Bima, NTB
  const DEFAULT_LAT = -8.505668;
  const DEFAULT_LNG = 118.605591;
  const DEFAULT_ZOOM = 18;

  // Initialize Map
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    // Avoid double-initialization on the same DOM element
    if ((container as any)._leaflet_id) {
      return;
    }

    // Clear any residual inner HTML to prevent duplicate map containers or controls
    container.innerHTML = '';

    // Create Leaflet Map Instance
    const mapInstance = L.map(container, {
      center: [DEFAULT_LAT, DEFAULT_LNG],
      zoom: DEFAULT_ZOOM,
      zoomControl: true
    });

    mapRef.current = mapInstance;

    // Create Group for Markers
    const markersGroup = L.layerGroup().addTo(mapInstance);
    markersGroupRef.current = markersGroup;

    // Cleanup on unmount
    return () => {
      if (popupTimerRef.current) {
        clearTimeout(popupTimerRef.current);
      }
      if (mapInstance) {
        try {
          mapInstance.off();
          mapInstance.remove();
        } catch (err) {
          console.warn("Leaflet map cleanup ignored: ", err);
        }
        if (mapRef.current === mapInstance) {
          mapRef.current = null;
        }
      }
    };
  }, []);

  // Set Tile Layer (Basemap)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove existing tile layers
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    let tileUrl = '';
    let attribution = '';

    if (activeTile === 'satellite') {
      // Google Hybrid Satellite
      tileUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      attribution = '&copy; Google Maps Satellite';
    } else {
      // OpenStreetMap Streets
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attribution = '&copy; OpenStreetMap contributors';
    }

    L.tileLayer(tileUrl, {
      maxZoom: 20,
      attribution
    }).addTo(map);

  }, [activeTile]);

  // Update Markers when residents data change
  useEffect(() => {
    const map = mapRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();
    markersMapRef.current = {};
    const points: L.LatLng[] = [];

    residents.forEach((r) => {
      if (!r.koordinat) return;

      const parts = r.koordinat.split(',');
      if (parts.length !== 2) return;

      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);

      if (isNaN(lat) || isNaN(lng)) return;

      points.push(L.latLng(lat, lng));

      // Color mapping:
      // Green (#10b981) for "Sudah"
      // Orange (#f97316) for "Sedang Proses"
      // Yellow (#eab308) for "Belum"
      let color = '#eab308';
      let statusLabel = 'Belum Diajukan';
      
      if (r.terimaSertipikat === 'Sudah') {
        color = '#10b981';
        statusLabel = 'Sertipikat Terbit (Selesai)';
      } else if (r.terimaSertipikat === 'Sedang Proses') {
        color = '#f97316';
        statusLabel = 'Diproses di Kantor Pertanahan';
      }

      // Beautiful customized Circle Marker
      const marker = L.circleMarker([lat, lng], {
        radius: 8,
        fillColor: color,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9
      });

      // Simple hover tooltip
      marker.bindTooltip(`Unit ${r.nomorRumah}: ${r.nama}`, {
        permanent: false,
        direction: 'top'
      });

      // Handle marker click to open custom React detail modal
      marker.on('click', () => {
        setSelectedResident(r);
      });

      marker.addTo(markersGroup);
      markersMapRef.current[r.id] = marker;
    });

    // Auto fit map bounds on initial render to display all points
    if (points.length > 0 && !hasInitialFitRef.current && !locateResident) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
      hasInitialFitRef.current = true;
    }

  }, [residents, locateResident]);

  // Handle outside pan/locate events (e.g. from table selection)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !locateResident || !locateResident.koordinat) return;

    const parts = locateResident.koordinat.split(',');
    if (parts.length !== 2) return;

    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);

    if (!isNaN(lat) && !isNaN(lng)) {
      // Invalidate map size to prevent gray/broken layout tiles when switching tabs
      map.invalidateSize();

      // Smoothly fly to coordinate
      map.flyTo([lat, lng], 19, {
        animate: true,
        duration: 1.2
      });

      // Clear existing timers/pulses
      if (popupTimerRef.current) {
        clearTimeout(popupTimerRef.current);
      }

      // Add gorgeous pulsing highlight ripple effect to precisely point out the location
      const pulseCircle = L.circleMarker([lat, lng], {
        radius: 12,
        fillColor: '#3b82f6',
        color: '#2563eb',
        weight: 1.5,
        opacity: 0.9,
        fillOpacity: 0.45
      }).addTo(map);

      let currentRadius = 12;
      let currentOpacity = 0.9;
      const pulseInterval = setInterval(() => {
        currentRadius += 2.5;
        currentOpacity -= 0.08;
        if (currentOpacity <= 0) {
          clearInterval(pulseInterval);
          try {
            map.removeLayer(pulseCircle);
          } catch (e) {}
        } else {
          pulseCircle.setRadius(currentRadius);
          pulseCircle.setStyle({
            opacity: currentOpacity,
            fillOpacity: currentOpacity * 0.45
          });
        }
      }, 80);

      // Automatically open beautiful detailed Leaflet popup pointing exactly at the targeted marker
      popupTimerRef.current = setTimeout(() => {
        if (!mapRef.current) return;
        try {
          const markerObj = markersMapRef.current[locateResident.id];
          if (markerObj) {
            const customPopupContent = `
              <div style="font-family: 'Inter', sans-serif; padding: 6px; width: 190px; text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-b: 1px solid #f3f4f6; padding-bottom: 4px; margin-bottom: 5px;">
                  <span style="font-weight: 900; background: #eff6ff; color: #1d4ed8; padding: 2px 6px; border-radius: 4px; font-size: 11px;">Unit ${locateResident.nomorRumah}</span>
                  <span style="font-size: 8px; font-weight: 700; color: #9ca3af; text-transform: uppercase;">KOORDINAT</span>
                </div>
                <div style="font-weight: 800; font-size: 13px; color: #111827; margin-top: 2px;">${locateResident.nama}</div>
                <div style="font-size: 11px; color: #4b5563; font-weight: 500; margin-top: 1px;">Kec. ${locateResident.kecamatan}, Desa ${locateResident.desa}</div>
                <div style="font-size: 10px; font-weight: 600; color: #4b5563; margin-top: 3px;">Luas Kavling: <b>${locateResident.luas || '-'} m²</b></div>
                <div style="font-size: 10px; font-weight: 600; color: #4b5563; margin-top: 1px;">Alas Hak: <b>${locateResident.dokumenTanah || '-'}</b></div>
                <div style="margin-top: 6px; display: flex; align-items: center; gap: 4px;">
                  <span style="font-size: 9px; font-weight: 800; color: ${
                    locateResident.terimaSertipikat === 'Sudah' ? '#047857' : (locateResident.terimaSertipikat === 'Sedang Proses' ? '#c2410c' : '#b45309')
                  }; background: ${
                    locateResident.terimaSertipikat === 'Sudah' ? '#ecfdf5' : (locateResident.terimaSertipikat === 'Sedang Proses' ? '#fff7ed' : '#fef9c3')
                  }; padding: 2px 6px; border-radius: 4px; display: inline-block;">
                    Sertipikat: ${locateResident.terimaSertipikat === 'Sudah' ? 'TERBIT' : (locateResident.terimaSertipikat === 'Sedang Proses' ? 'PROSES BPN' : 'BELUM DIAJUKAN')}
                  </span>
                </div>
              </div>
            `;
            markerObj.bindPopup(customPopupContent, { closeButton: true, offset: [0, -5] }).openPopup();
          } else {
            // Fallback popup if marker is not in registry
            L.popup()
              .setLatLng([lat, lng])
              .setContent(`
                <div style="font-family: 'Inter', sans-serif; padding: 4px; width: 160px;">
                  <span style="font-weight: 800; color: #3b82f6;">Unit ${locateResident.nomorRumah}</span>
                  <div style="font-weight: 700; font-size: 12px; margin-top: 2px;">${locateResident.nama}</div>
                  <div style="font-size: 10px; color: #10b981; font-weight: 600; margin-top: 3px;">
                    Status: ${locateResident.terimaSertipikat}
                  </div>
                </div>
              `)
              .openOn(mapRef.current);
          }
        } catch (e) {
          console.warn("Failed to open locate popup safely:", e);
        }
      }, 1300);
    }

    onClearLocate();

    return () => {
      if (popupTimerRef.current) {
        clearTimeout(popupTimerRef.current);
      }
    };
  }, [locateResident, onClearLocate]);

  const handleResetView = () => {
    const map = mapRef.current;
    if (!map) return;
    
    const points: L.LatLng[] = [];
    residents.forEach(r => {
      if (!r.koordinat) return;
      const parts = r.koordinat.split(',');
      if (parts.length === 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          points.push(L.latLng(lat, lng));
        }
      }
    });

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
    } else {
      map.setView([DEFAULT_LAT, DEFAULT_LNG], DEFAULT_ZOOM);
    }
  };

  return (
    <div className="space-y-4">
      {/* Map Controls */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
            <Compass className="h-4.5 w-4.5 text-pastel-orange" /> Peta Sebaran Sertipikasi Hunian Tetap (Huntap)
          </h3>
          <p className="text-[11px] text-slate-500">
            Sebaran lokasi unit huntap Desa Tambe, Kecamatan Bolo, Kabupaten Bima.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Basemap Toggles */}
          <button 
            onClick={() => setActiveTile('streets')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-1.5 ${activeTile === 'streets' ? 'bg-pastel-blue text-white shadow-xs' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
          >
            <Globe className="h-3.5 w-3.5" /> Peta Jalan (OSM)
          </button>
          
          <button 
            onClick={() => setActiveTile('satellite')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-1.5 ${activeTile === 'satellite' ? 'bg-pastel-blue text-white shadow-xs' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
          >
            <Layers className="h-3.5 w-3.5" /> Citra Satelit
          </button>

          <button 
            id="btn-reset-fokus"
            onClick={handleResetView}
            className="px-4 py-2 rounded-xl bg-pastel-brown-light hover:bg-orange-100/40 border border-orange-100 text-pastel-orange font-bold text-xs transition"
          >
            Reset Fokus
          </button>
        </div>
      </div>

      {/* Actual Map Canvas container */}
      <div id="map-container-canvas" className="bg-white p-2 rounded-3xl border border-slate-100 shadow-xs overflow-hidden relative">
        <div ref={mapContainerRef} className="h-[480px] w-full rounded-2xl z-10 border border-slate-100"></div>

        {/* Floating Legends */}
        <div className="absolute bottom-6 left-6 z-20 bg-white/95 backdrop-blur-xs p-4 rounded-2xl border border-slate-200/80 shadow-md space-y-2 max-w-xs">
          <h5 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Info className="h-3.5 w-3.5 text-pastel-blue" /> Keterangan Status
          </h5>
          <div className="space-y-1.5 text-[11px] font-semibold text-slate-700">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-[#10b981] border border-white inline-block"></span>
              <span>Sertipikat Terbit (Selesai)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-[#f97316] border border-white inline-block"></span>
              <span>Sedang Diproses (BPN)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-[#eab308] border border-white inline-block"></span>
              <span>Belum Diajukan</span>
            </div>
          </div>
        </div>
      </div>

      {/* Resident Detail Modal (Slide-out or Popup Overlay) */}
      {selectedResident && (
        <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
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
            <div className="p-6 space-y-6 text-left">
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
                className="px-5 py-2 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Tutup Detail
              </button>
              {currentUserRole !== 'Warga' && onEdit && (
                <button 
                  onClick={() => {
                    onEdit(selectedResident);
                    setSelectedResident(null);
                  }}
                  className="px-5 py-2 rounded-full bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Edit2 className="h-3.5 w-3.5" /> Edit Data
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
