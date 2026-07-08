/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  MapPin, Globe, Compass, Home, Layers, Check, Info, X, 
  User, Key, Phone, Ruler, Clock, Edit2, Search
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
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered residents list for global search under the map
  const filteredSearchResidents = React.useMemo(() => {
    if (!searchQuery.trim()) return residents;
    const q = searchQuery.toLowerCase().trim();
    return residents.filter(r => 
      (r.nama || '').toLowerCase().includes(q) ||
      (r.nomorRumah || '').toLowerCase().includes(q) ||
      (r.nik || '').toLowerCase().includes(q) ||
      (r.noKk || '').toLowerCase().includes(q) ||
      (r.desa || '').toLowerCase().includes(q)
    );
  }, [residents, searchQuery]);

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

      // Beautiful customized hover tooltip showing Nama Penerima and Nomor Rumah
      marker.bindTooltip(`
        <div style="font-family: 'Inter', sans-serif; padding: 4px 6px;">
          <div style="font-weight: 800; font-size: 11px; color: #2563eb; margin-bottom: 2px;">Unit ${r.nomorRumah || '-'}</div>
          <div style="font-weight: 600; font-size: 11px; color: #374151;">Penerima: ${r.nama || '-'}</div>
        </div>
      `, {
        permanent: false,
        direction: 'top',
        opacity: 0.95
      });

      // Mouseover hover effects
      marker.on('mouseover', function () {
        this.setStyle({
          radius: 12,
          weight: 4,
          fillOpacity: 1
        });
      });

      // Mouseout hover reset
      marker.on('mouseout', function () {
        this.setStyle({
          radius: 8,
          weight: 2,
          fillOpacity: 0.9
        });
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

  }, [residents]);

  // Reusable function to focus on a resident on the map
  const focusOnResident = (res: Resident) => {
    const map = mapRef.current;
    if (!map || !res.koordinat) return;

    const parts = res.koordinat.split(',');
    if (parts.length !== 2) return;

    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);

    if (!isNaN(lat) && !isNaN(lng)) {
      // Invalidate map size to prevent gray/broken layout tiles when switching tabs
      map.invalidateSize();

      // Smoothly fly to coordinate with max detail focus
      map.flyTo([lat, lng], 20, {
        animate: true,
        duration: 1.2
      });

      // Clear existing timers/pulses
      if (popupTimerRef.current) {
        clearTimeout(popupTimerRef.current);
      }

      // Highlight target marker as focused/hovered & open tooltip automatically
      const markerObj = markersMapRef.current[res.id];
      if (markerObj) {
        markerObj.setStyle({
          radius: 13,
          weight: 5,
          fillOpacity: 1
        });
        try {
          markerObj.openTooltip();
        } catch (e) {
          console.warn("Could not auto-open tooltip:", e);
        }
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
          const mObj = markersMapRef.current[res.id];
          if (mObj) {
            const customPopupContent = `
              <div style="font-family: 'Inter', sans-serif; padding: 6px; width: 190px; text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-b: 1px solid #f3f4f6; padding-bottom: 4px; margin-bottom: 5px;">
                  <span style="font-weight: 900; background: #eff6ff; color: #1d4ed8; padding: 2px 6px; border-radius: 4px; font-size: 11px;">Unit ${res.nomorRumah}</span>
                  <span style="font-size: 8px; font-weight: 700; color: #9ca3af; text-transform: uppercase;">KOORDINAT</span>
                </div>
                <div style="font-weight: 800; font-size: 13px; color: #111827; margin-top: 2px;">${res.nama}</div>
                <div style="font-size: 11px; color: #4b5563; font-weight: 500; margin-top: 1px;">Kec. ${res.kecamatan}, Desa ${res.desa}</div>
                <div style="font-size: 10px; font-weight: 600; color: #4b5563; margin-top: 3px;">Luas Kavling: <b>${res.luas || '-'} m²</b></div>
                <div style="font-size: 10px; font-weight: 600; color: #4b5563; margin-top: 1px;">Alas Hak: <b>${res.dokumenTanah || '-'}</b></div>
                <div style="margin-top: 6px; display: flex; align-items: center; gap: 4px;">
                  <span style="font-size: 9px; font-weight: 800; color: ${
                    res.terimaSertipikat === 'Sudah' ? '#047857' : (res.terimaSertipikat === 'Sedang Proses' ? '#c2410c' : '#b45309')
                  }; background: ${
                    res.terimaSertipikat === 'Sudah' ? '#ecfdf5' : (res.terimaSertipikat === 'Sedang Proses' ? '#fff7ed' : '#fef9c3')
                  }; padding: 2px 6px; border-radius: 4px; display: inline-block;">
                    Sertipikat: ${res.terimaSertipikat === 'Sudah' ? 'TERBIT' : (res.terimaSertipikat === 'Sedang Proses' ? 'PROSES BPN' : 'BELUM DIAJUKAN')}
                  </span>
                </div>
              </div>
            `;
            mObj.bindPopup(customPopupContent, { closeButton: true, offset: [0, -5] }).openPopup();

            // Revert style back to normal when popup is closed
            mapRef.current.once('popupclose', () => {
              mObj.setStyle({
                radius: 8,
                weight: 2,
                fillOpacity: 0.9
              });
            });
          } else {
            // Fallback popup if marker is not in registry
            L.popup()
              .setLatLng([lat, lng])
              .setContent(`
                <div style="font-family: 'Inter', sans-serif; padding: 4px; width: 160px;">
                  <span style="font-weight: 800; color: #3b82f6;">Unit ${res.nomorRumah}</span>
                  <div style="font-weight: 700; font-size: 12px; margin-top: 2px;">${res.nama}</div>
                  <div style="font-size: 10px; color: #10b981; font-weight: 600; margin-top: 3px;">
                    Status: ${res.terimaSertipikat}
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
  };

  // Handle outside pan/locate events (e.g. from table selection)
  useEffect(() => {
    let timer: any = null;
    if (locateResident) {
      // Small delay of 250ms ensures that the map container is fully mounted, visible,
      // and layout sizes are settled after switching tabs.
      timer = setTimeout(() => {
        focusOnResident(locateResident);
      }, 250);
    }
    onClearLocate();

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
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

      {/* Global Search Input Card */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Cari Penerima Huntap (Nama, No. Rumah, NIK, No. KK, atau Desa/Wilayah) secara global..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 text-xs font-semibold rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-hidden transition-all duration-250"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition"
              title="Bersihkan Pencarian"
            >
              <X className="h-3 w-3" />
            </button>
          )}
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

      {/* Search Results Card below the map */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Search className="h-4 w-4 text-blue-600" /> 
              {searchQuery ? 'Hasil Pencarian Unit Huntap' : 'Daftar Lokasi Unit Huntap'}
            </h4>
            <p className="text-[10px] text-slate-500">
              {searchQuery 
                ? `Menampilkan ${filteredSearchResidents.length} dari ${residents.length} unit yang cocok dengan "${searchQuery}"` 
                : `Menampilkan semua ${residents.length} unit huntap yang terdaftar`
              }
            </p>
          </div>
          <span className="text-[10px] font-extrabold bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-100 self-start sm:self-center">
            {filteredSearchResidents.length} Unit
          </span>
        </div>

        {filteredSearchResidents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[350px] overflow-y-auto pr-1">
            {filteredSearchResidents.map((r) => {
              let statusColor = 'text-amber-600 bg-amber-50 border-amber-100';
              if (r.terimaSertipikat === 'Sudah') {
                statusColor = 'text-emerald-600 bg-emerald-50 border-emerald-100';
              } else if (r.terimaSertipikat === 'Sedang Proses') {
                statusColor = 'text-orange-600 bg-orange-50 border-orange-100';
              }

              const hasCoords = !!r.koordinat && r.koordinat.includes(',');

              return (
                <div 
                  key={r.id} 
                  className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-blue-100 hover:shadow-sm transition duration-150 flex flex-col justify-between gap-3 text-left group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="bg-blue-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-lg">
                        Unit {r.nomorRumah || '-'}
                      </span>
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md border ${statusColor}`}>
                        {r.terimaSertipikat === 'Sudah' ? 'SHM TERBIT' : (r.terimaSertipikat === 'Sedang Proses' ? 'PROSES BPN' : 'BELUM DIAJUKAN')}
                      </span>
                    </div>

                    <div>
                      <h5 className="font-bold text-slate-800 text-xs truncate group-hover:text-blue-600 transition" title={r.nama}>
                        {r.nama || '-'}
                      </h5>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        NIK: {r.nik || '-'}
                      </p>
                      <p className="text-[10px] text-slate-500 font-semibold mt-1">
                        Desa {r.desa || '-'}, Kec. {r.kecamatan || '-'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                      <MapPin className={`h-3.5 w-3.5 ${hasCoords ? 'text-blue-500' : 'text-slate-300'}`} />
                      <span className="text-[9px] font-mono text-slate-400 truncate max-w-[100px]">
                        {hasCoords ? r.koordinat : 'Tidak ada koordinat'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setSelectedResident(r)}
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                        title="Buka Detail"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                      {hasCoords && (
                        <button
                          onClick={() => {
                            focusOnResident(r);
                            // Scroll smoothly to map container
                            const mapEl = document.getElementById('map-container-canvas');
                            if (mapEl) {
                              mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                          }}
                          className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white transition flex items-center gap-1 cursor-pointer"
                        >
                          Fokus Peta
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 text-xs font-semibold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            Tidak menemukan penerima huntap dengan kata kunci "{searchQuery}"
          </div>
        )}
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
