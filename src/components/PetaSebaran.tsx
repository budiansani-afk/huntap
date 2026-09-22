/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { 
  MapPin, Globe, Compass, Home, Layers, Check, Info, X, 
  User, Key, Phone, Ruler, Clock, Edit2, Search, Route, ExternalLink 
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
  const huntapGroupRef = useRef<L.LayerGroup | null>(null);
  const asalGroupRef = useRef<L.LayerGroup | null>(null);
  const linesGroupRef = useRef<L.LayerGroup | null>(null);
  const huntapMarkersMapRef = useRef<Record<string, L.CircleMarker>>({});
  const asalMarkersMapRef = useRef<Record<string, L.CircleMarker>>({});
  const hasInitialFitRef = useRef(false);
  const popupTimerRef = useRef<any>(null);
  const [activeTile, setActiveTile] = useState<'streets' | 'satellite'>('satellite');
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Layer Visibility Controls
  const [showHuntap, setShowHuntap] = useState(true);
  const [showTanahAsal, setShowTanahAsal] = useState(true);
  const [showRelocationLines, setShowRelocationLines] = useState(true);

  // Statistics
  const countHuntap = useMemo(() => residents.filter(r => !!r.koordinat && r.koordinat.includes(',')).length, [residents]);
  const countTanahAsal = useMemo(() => residents.filter(r => !!r.koordinatAsal && r.koordinatAsal.includes(',')).length, [residents]);
  const countBoth = useMemo(() => residents.filter(r => !!r.koordinat && r.koordinat.includes(',') && !!r.koordinatAsal && r.koordinatAsal.includes(',')).length, [residents]);

  // Filtered residents list for global search under the map
  const filteredSearchResidents = useMemo(() => {
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
  const DEFAULT_ZOOM = 17;

  // Initialize Map
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    if ((container as any)._leaflet_id) {
      return;
    }

    container.innerHTML = '';

    const mapInstance = L.map(container, {
      center: [DEFAULT_LAT, DEFAULT_LNG],
      zoom: DEFAULT_ZOOM,
      zoomControl: true
    });

    mapRef.current = mapInstance;

    // Create Groups for Markers and Polyline Connectors
    linesGroupRef.current = L.layerGroup().addTo(mapInstance);
    huntapGroupRef.current = L.layerGroup().addTo(mapInstance);
    asalGroupRef.current = L.layerGroup().addTo(mapInstance);

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

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    let tileUrl = '';
    let attribution = '';

    if (activeTile === 'satellite') {
      tileUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      attribution = '&copy; Google Maps Satellite';
    } else {
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attribution = '&copy; OpenStreetMap contributors';
    }

    L.tileLayer(tileUrl, {
      maxZoom: 20,
      attribution
    }).addTo(map);

  }, [activeTile]);

  // Update Markers & Connectors when residents or layer visibility change
  useEffect(() => {
    const map = mapRef.current;
    const huntapGroup = huntapGroupRef.current;
    const asalGroup = asalGroupRef.current;
    const linesGroup = linesGroupRef.current;
    if (!map || !huntapGroup || !asalGroup || !linesGroup) return;

    huntapGroup.clearLayers();
    asalGroup.clearLayers();
    linesGroup.clearLayers();
    huntapMarkersMapRef.current = {};
    asalMarkersMapRef.current = {};
    const points: L.LatLng[] = [];

    residents.forEach((r) => {
      let huntapLatLng: L.LatLng | null = null;
      let asalLatLng: L.LatLng | null = null;

      // 1. Lokasi Unit Huntap
      if (r.koordinat) {
        const parts = r.koordinat.split(',');
        if (parts.length === 2) {
          const lat = parseFloat(parts[0]);
          const lng = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lng)) {
            huntapLatLng = L.latLng(lat, lng);
            if (showHuntap) {
              points.push(huntapLatLng);

              let color = '#eab308';
              if (r.terimaSertipikat === 'Sudah') {
                color = '#10b981';
              } else if (r.terimaSertipikat === 'Sedang Proses') {
                color = '#f97316';
              }

              const marker = L.circleMarker([lat, lng], {
                radius: 8,
                fillColor: color,
                color: '#ffffff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9
              });

              marker.bindTooltip(`
                <div style="font-family: 'Inter', sans-serif; padding: 4px 6px;">
                  <div style="font-weight: 800; font-size: 11px; color: #2563eb; margin-bottom: 2px;">Unit ${r.nomorRumah || '-'} (Huntap)</div>
                  <div style="font-weight: 600; font-size: 11px; color: #374151;">Penerima: ${r.nama || '-'}</div>
                  <div style="font-size: 10px; color: #6b7280;">Status: ${r.terimaSertipikat}</div>
                </div>
              `, {
                permanent: false,
                direction: 'top',
                opacity: 0.95
              });

              marker.on('mouseover', function () {
                this.setStyle({ radius: 12, weight: 4, fillOpacity: 1 });
              });

              marker.on('mouseout', function () {
                this.setStyle({ radius: 8, weight: 2, fillOpacity: 0.9 });
              });

              marker.on('click', () => {
                setSelectedResident(r);
              });

              marker.addTo(huntapGroup);
              huntapMarkersMapRef.current[r.id] = marker;
            }
          }
        }
      }

      // 2. Lokasi Tanah Asal
      if (r.koordinatAsal) {
        const partsAsal = r.koordinatAsal.split(',');
        if (partsAsal.length === 2) {
          const latA = parseFloat(partsAsal[0]);
          const lngA = parseFloat(partsAsal[1]);
          if (!isNaN(latA) && !isNaN(lngA)) {
            asalLatLng = L.latLng(latA, lngA);
            if (showTanahAsal) {
              points.push(asalLatLng);

              const asalMarker = L.circleMarker([latA, lngA], {
                radius: 9,
                fillColor: '#8b5cf6', // Violet/purple for original land
                color: '#ffffff',
                weight: 2.5,
                opacity: 1,
                fillOpacity: 0.95
              });

              asalMarker.bindTooltip(`
                <div style="font-family: 'Inter', sans-serif; padding: 4px 6px;">
                  <div style="font-weight: 800; font-size: 11px; color: #7c3aed; margin-bottom: 2px;">📍 Lokasi Tanah Asal: Unit ${r.nomorRumah || '-'}</div>
                  <div style="font-weight: 600; font-size: 11px; color: #374151;">Pemilik: ${r.nama || '-'}</div>
                  <div style="font-size: 10px; color: #6b7280;">Desa ${r.desa || '-'}, Alas Hak: ${r.dokumenTanah || '-'}</div>
                </div>
              `, {
                permanent: false,
                direction: 'top',
                opacity: 0.95
              });

              asalMarker.on('mouseover', function () {
                this.setStyle({ radius: 13, weight: 4.5, fillOpacity: 1 });
              });

              asalMarker.on('mouseout', function () {
                this.setStyle({ radius: 9, weight: 2.5, fillOpacity: 0.95 });
              });

              asalMarker.on('click', () => {
                setSelectedResident(r);
              });

              asalMarker.addTo(asalGroup);
              asalMarkersMapRef.current[r.id] = asalMarker;
            }
          }
        }
      }

      // 3. Garis Hubung Relokasi (Polyline from Tanah Asal to Huntap)
      if (huntapLatLng && asalLatLng && showRelocationLines) {
        const distMeters = asalLatLng.distanceTo(huntapLatLng);
        const distText = distMeters >= 1000 
          ? `${(distMeters / 1000).toFixed(2)} km` 
          : `${Math.round(distMeters)} meter`;

        const connectorLine = L.polyline([asalLatLng, huntapLatLng], {
          color: '#8b5cf6',
          weight: 2,
          opacity: 0.75,
          dashArray: '5, 8'
        });

        connectorLine.bindTooltip(`
          <div style="font-family: 'Inter', sans-serif; padding: 3px 6px; font-size: 10px;">
            <span style="font-weight: 800; color: #7c3aed;">Jalur Relokasi: Unit ${r.nomorRumah} (${r.nama})</span><br/>
            Jarak: <b>${distText}</b> (Desa ${r.desa} ➔ Huntap Tambe)
          </div>
        `, {
          sticky: true,
          direction: 'center'
        });

        connectorLine.on('click', () => {
          setSelectedResident(r);
        });

        connectorLine.addTo(linesGroup);
      }
    });

    // Auto fit bounds on initial render or when requested
    if (points.length > 0 && !hasInitialFitRef.current && !locateResident) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
      hasInitialFitRef.current = true;
    }

  }, [residents, showHuntap, showTanahAsal, showRelocationLines]);

  // Reusable function to focus on a resident on the map
  const focusOnResident = (res: Resident, target: 'huntap' | 'asal' | 'both' = 'huntap') => {
    const map = mapRef.current;
    if (!map) return;

    let targetLat: number | null = null;
    let targetLng: number | null = null;
    let isAsal = false;

    if (target === 'asal' && res.koordinatAsal) {
      const parts = res.koordinatAsal.split(',');
      if (parts.length === 2) {
        targetLat = parseFloat(parts[0]);
        targetLng = parseFloat(parts[1]);
        isAsal = true;
      }
    } else if (res.koordinat) {
      const parts = res.koordinat.split(',');
      if (parts.length === 2) {
        targetLat = parseFloat(parts[0]);
        targetLng = parseFloat(parts[1]);
        isAsal = false;
      }
    } else if (res.koordinatAsal) {
      const parts = res.koordinatAsal.split(',');
      if (parts.length === 2) {
        targetLat = parseFloat(parts[0]);
        targetLng = parseFloat(parts[1]);
        isAsal = true;
      }
    }

    if (targetLat === null || targetLng === null || isNaN(targetLat) || isNaN(targetLng)) return;

    map.invalidateSize();

    // If both requested and available, fit bounds to show both points
    if (target === 'both' && res.koordinat && res.koordinatAsal) {
      const huntapParts = res.koordinat.split(',').map(p => parseFloat(p));
      const asalParts = res.koordinatAsal.split(',').map(p => parseFloat(p));
      if (!isNaN(huntapParts[0]) && !isNaN(asalParts[0])) {
        const bounds = L.latLngBounds([
          [huntapParts[0], huntapParts[1]],
          [asalParts[0], asalParts[1]]
        ]);
        map.fitBounds(bounds, { padding: [80, 80], maxZoom: 18 });
        return;
      }
    }

    map.flyTo([targetLat, targetLng], 19, {
      animate: true,
      duration: 1.2
    });

    if (popupTimerRef.current) {
      clearTimeout(popupTimerRef.current);
    }

    const markerObj = isAsal 
      ? asalMarkersMapRef.current[res.id] 
      : huntapMarkersMapRef.current[res.id];

    if (markerObj) {
      markerObj.setStyle({
        radius: 13,
        weight: 5,
        fillOpacity: 1
      });
      try {
        markerObj.openTooltip();
      } catch (e) {}
    }

    // Add pulsing highlight ripple effect
    const pulseColor = isAsal ? '#8b5cf6' : '#3b82f6';
    const pulseBorder = isAsal ? '#7c3aed' : '#2563eb';
    const pulseCircle = L.circleMarker([targetLat, targetLng], {
      radius: 12,
      fillColor: pulseColor,
      color: pulseBorder,
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

    // Automatically open detailed Leaflet popup
    popupTimerRef.current = setTimeout(() => {
      if (!mapRef.current) return;
      try {
        const mObj = isAsal 
          ? asalMarkersMapRef.current[res.id] 
          : huntapMarkersMapRef.current[res.id];

        const popupTitle = isAsal ? '📍 LOKASI TANAH ASAL' : `Unit ${res.nomorRumah}`;
        const typeLabel = isAsal ? 'ASAL RELOKASI' : 'UNIT HUNTAP';

        const customPopupContent = `
          <div style="font-family: 'Inter', sans-serif; padding: 6px; width: 210px; text-align: left;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f3f4f6; padding-bottom: 4px; margin-bottom: 5px;">
              <span style="font-weight: 900; background: ${isAsal ? '#f3e8ff' : '#eff6ff'}; color: ${isAsal ? '#7c3aed' : '#1d4ed8'}; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${popupTitle}</span>
              <span style="font-size: 8px; font-weight: 700; color: #9ca3af; text-transform: uppercase;">${typeLabel}</span>
            </div>
            <div style="font-weight: 800; font-size: 13px; color: #111827; margin-top: 2px;">${res.nama}</div>
            <div style="font-size: 11px; color: #4b5563; font-weight: 500; margin-top: 1px;">Kec. ${res.kecamatan}, Desa ${res.desa}</div>
            <div style="font-size: 10px; font-weight: 600; color: #4b5563; margin-top: 3px;">Luas: <b>${res.luas || '-'} m²</b></div>
            <div style="font-size: 10px; font-weight: 600; color: #4b5563; margin-top: 1px;">Alas Hak Asal: <b>${res.dokumenTanah || '-'}</b></div>
            ${isAsal ? `
              <div style="margin-top: 5px; font-size: 9px; font-family: monospace; background: #fdf4ff; color: #7e22ce; padding: 2px 5px; border-radius: 4px; border: 1px solid #f5d0fe;">
                Koordinat Asal: ${res.koordinatAsal}
              </div>
            ` : `
              <div style="margin-top: 6px; display: flex; align-items: center; gap: 4px;">
                <span style="font-size: 9px; font-weight: 800; color: ${
                  res.terimaSertipikat === 'Sudah' ? '#047857' : (res.terimaSertipikat === 'Sedang Proses' ? '#c2410c' : '#b45309')
                }; background: ${
                  res.terimaSertipikat === 'Sudah' ? '#ecfdf5' : (res.terimaSertipikat === 'Sedang Proses' ? '#fff7ed' : '#fef9c3')
                }; padding: 2px 6px; border-radius: 4px; display: inline-block;">
                  Sertipikat: ${res.terimaSertipikat === 'Sudah' ? 'TERBIT' : (res.terimaSertipikat === 'Sedang Proses' ? 'PROSES BPN' : 'BELUM DIAJUKAN')}
                </span>
              </div>
            `}
          </div>
        `;

        if (mObj) {
          mObj.bindPopup(customPopupContent, { closeButton: true, offset: [0, -5] }).openPopup();
          mapRef.current.once('popupclose', () => {
            mObj.setStyle({
              radius: isAsal ? 9 : 8,
              weight: isAsal ? 2.5 : 2,
              fillOpacity: isAsal ? 0.95 : 0.9
            });
          });
        } else {
          L.popup()
            .setLatLng([targetLat, targetLng])
            .setContent(customPopupContent)
            .openOn(mapRef.current);
        }
      } catch (e) {
        console.warn("Popup error:", e);
      }
    }, 1300);
  };

  // Handle outside pan/locate events (e.g. from table selection)
  useEffect(() => {
    let timer: any = null;
    if (locateResident) {
      timer = setTimeout(() => {
        focusOnResident(locateResident, 'huntap');
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
      if (showHuntap && r.koordinat) {
        const parts = r.koordinat.split(',');
        if (parts.length === 2) {
          const lat = parseFloat(parts[0]);
          const lng = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lng)) points.push(L.latLng(lat, lng));
        }
      }
      if (showTanahAsal && r.koordinatAsal) {
        const parts = r.koordinatAsal.split(',');
        if (parts.length === 2) {
          const lat = parseFloat(parts[0]);
          const lng = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lng)) points.push(L.latLng(lat, lng));
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

  // Helper calculation for distance between resident coordinates
  const calculateDistance = (coord1?: string, coord2?: string): string | null => {
    if (!coord1 || !coord2) return null;
    const p1 = coord1.split(',').map(p => parseFloat(p));
    const p2 = coord2.split(',').map(p => parseFloat(p));
    if (p1.length === 2 && p2.length === 2 && !isNaN(p1[0]) && !isNaN(p2[0])) {
      const d = L.latLng(p1[0], p1[1]).distanceTo(L.latLng(p2[0], p2[1]));
      return d >= 1000 ? `${(d / 1000).toFixed(2)} km` : `${Math.round(d)} meter`;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Map Header & Controls */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
            <Compass className="h-4.5 w-4.5 text-pastel-orange" /> Peta Sebaran Sertipikasi & Relokasi Tanah Huntap
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Visualisasi titik unit hunian tetap (Desa Tambe) dan titik lokasi tanah/lahan asal warga terdampak.
          </p>
        </div>

        {/* Action Controls & Layer Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Layer: Unit Huntap */}
          <button 
            onClick={() => setShowHuntap(!showHuntap)}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
              showHuntap 
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs' 
                : 'bg-slate-50 text-slate-400 border border-slate-200 line-through opacity-70'
            }`}
            title="Tampilkan / Sembunyikan Lokasi Unit Huntap"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            <span>Huntap ({countHuntap})</span>
          </button>

          {/* Layer: Tanah Asal */}
          <button 
            onClick={() => setShowTanahAsal(!showTanahAsal)}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
              showTanahAsal 
                ? 'bg-purple-50 text-purple-700 border border-purple-200 shadow-xs' 
                : 'bg-slate-50 text-slate-400 border border-slate-200 line-through opacity-70'
            }`}
            title="Tampilkan / Sembunyikan Lokasi Tanah Asal"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
            <span>Tanah Asal ({countTanahAsal})</span>
          </button>

          {/* Layer: Garis Relokasi */}
          <button 
            onClick={() => setShowRelocationLines(!showRelocationLines)}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
              showRelocationLines 
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs' 
                : 'bg-slate-50 text-slate-400 border border-slate-200 line-through opacity-70'
            }`}
            title="Tampilkan / Sembunyikan Garis Hubung Relokasi"
          >
            <Route className="h-3 w-3 text-indigo-600" />
            <span>Jalur ({countBoth})</span>
          </button>

          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>

          {/* Basemap Toggles */}
          <button 
            onClick={() => setActiveTile('streets')}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1 cursor-pointer ${activeTile === 'streets' ? 'bg-pastel-blue text-white shadow-xs' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
          >
            <Globe className="h-3.5 w-3.5" /> Jalan
          </button>
          
          <button 
            onClick={() => setActiveTile('satellite')}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1 cursor-pointer ${activeTile === 'satellite' ? 'bg-pastel-blue text-white shadow-xs' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
          >
            <Layers className="h-3.5 w-3.5" /> Satelit
          </button>

          <button 
            id="btn-reset-fokus"
            onClick={handleResetView}
            className="px-3.5 py-1.5 rounded-xl bg-pastel-brown-light hover:bg-orange-100/40 border border-orange-100 text-pastel-orange font-bold text-xs transition cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Global Search Input Card */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Cari Penerima (Nama, No. Rumah, NIK, No. KK, atau Desa Asal) untuk difokuskan di peta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 text-xs font-semibold rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-hidden transition-all duration-250"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
              title="Bersihkan Pencarian"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Actual Map Canvas container */}
      <div id="map-container-canvas" className="bg-white p-2 rounded-3xl border border-slate-100 shadow-xs overflow-hidden relative">
        <div ref={mapContainerRef} className="h-[500px] w-full rounded-2xl z-10 border border-slate-100"></div>

        {/* Floating Legends */}
        <div className="absolute bottom-6 left-6 z-20 bg-white/95 backdrop-blur-xs p-4 rounded-2xl border border-slate-200/80 shadow-md space-y-2 max-w-xs text-left">
          <h5 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Info className="h-3.5 w-3.5 text-pastel-blue" /> Legenda Peta
          </h5>
          <div className="space-y-1.5 text-[11px] font-semibold text-slate-700">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-[#10b981] border border-white inline-block shrink-0 shadow-xs"></span>
              <span>Huntap: SHM Terbit (Selesai)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-[#f97316] border border-white inline-block shrink-0 shadow-xs"></span>
              <span>Huntap: Proses BPN</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-[#eab308] border border-white inline-block shrink-0 shadow-xs"></span>
              <span>Huntap: Belum Diajukan</span>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
              <span className="w-3.5 h-3.5 rounded-full bg-[#8b5cf6] border-2 border-white inline-block shrink-0 shadow-xs"></span>
              <span className="text-purple-900 font-bold">📍 Lokasi Tanah Asal (Lahan Awal)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-0.5 border-t-2 border-dashed border-purple-500 inline-block shrink-0"></span>
              <span className="text-slate-500 text-[10px]">Garis Relokasi Tanah Asal ➔ Huntap</span>
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
              {searchQuery ? 'Hasil Pencarian Data Geospasial' : 'Daftar Unit Huntap & Tanah Asal'}
            </h4>
            <p className="text-[10px] text-slate-500">
              {searchQuery 
                ? `Menampilkan ${filteredSearchResidents.length} dari ${residents.length} warga yang cocok dengan "${searchQuery}"` 
                : `Menampilkan semua ${residents.length} warga penerima huntap`
              }
            </p>
          </div>
          <span className="text-[10px] font-extrabold bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-100 self-start sm:self-center">
            {filteredSearchResidents.length} Data
          </span>
        </div>

        {filteredSearchResidents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[420px] overflow-y-auto pr-1">
            {filteredSearchResidents.map((r) => {
              let statusColor = 'text-amber-600 bg-amber-50 border-amber-100';
              if (r.terimaSertipikat === 'Sudah') {
                statusColor = 'text-emerald-600 bg-emerald-50 border-emerald-100';
              } else if (r.terimaSertipikat === 'Sedang Proses') {
                statusColor = 'text-orange-600 bg-orange-50 border-orange-100';
              }

              const hasHuntapCoords = !!r.koordinat && r.koordinat.includes(',');
              const hasAsalCoords = !!r.koordinatAsal && r.koordinatAsal.includes(',');
              const distance = calculateDistance(r.koordinat, r.koordinatAsal);

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
                        Desa Asal: {r.desa || '-'}, Kec. {r.kecamatan || '-'}
                      </p>
                    </div>

                    {/* Dual Coordinates Display */}
                    <div className="space-y-1 pt-1 text-[10px]">
                      {/* Huntap */}
                      <div className="flex items-center justify-between bg-blue-50/60 p-1.5 rounded-lg border border-blue-100/60">
                        <div className="flex items-center gap-1 text-blue-900 font-semibold truncate">
                          <Home className="h-3 w-3 text-blue-600 shrink-0" />
                          <span className="truncate">Huntap: {hasHuntapCoords ? r.koordinat : 'Belum diisi'}</span>
                        </div>
                        {hasHuntapCoords && (
                          <button
                            type="button"
                            onClick={() => {
                              focusOnResident(r, 'huntap');
                              const mapEl = document.getElementById('map-container-canvas');
                              if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            className="text-[9px] px-1.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md shrink-0 cursor-pointer"
                          >
                            Fokus
                          </button>
                        )}
                      </div>

                      {/* Tanah Asal */}
                      <div className="flex items-center justify-between bg-purple-50/60 p-1.5 rounded-lg border border-purple-100/60">
                        <div className="flex items-center gap-1 text-purple-900 font-semibold truncate">
                          <MapPin className="h-3 w-3 text-purple-600 shrink-0" />
                          <span className="truncate">Asal: {hasAsalCoords ? r.koordinatAsal : 'Belum diisi'}</span>
                        </div>
                        {hasAsalCoords && (
                          <button
                            type="button"
                            onClick={() => {
                              focusOnResident(r, 'asal');
                              const mapEl = document.getElementById('map-container-canvas');
                              if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            className="text-[9px] px-1.5 py-0.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-md shrink-0 cursor-pointer"
                          >
                            Fokus
                          </button>
                        )}
                      </div>

                      {/* Distance Badge if both coordinates exist */}
                      {distance && (
                        <div className="flex items-center justify-between text-[9px] text-indigo-700 bg-indigo-50/80 px-2 py-1 rounded-md font-semibold border border-indigo-100">
                          <span className="flex items-center gap-1">
                            <Route className="h-3 w-3 text-indigo-600" />
                            Jarak Relokasi: ~{distance}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              focusOnResident(r, 'both');
                              const mapEl = document.getElementById('map-container-canvas');
                              if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            className="text-indigo-800 hover:underline font-bold cursor-pointer"
                          >
                            Lihat Jalur
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => setSelectedResident(r)}
                      className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] transition cursor-pointer flex items-center gap-1"
                      title="Buka Detail Lengkap"
                    >
                      <Info className="h-3 w-3" /> Detail
                    </button>
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
                className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
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

                  <div className="flex items-start gap-2">
                    <Ruler className="h-4 w-4 text-pastel-orange shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Luas & Alas Hak Asal</div>
                      <div className="text-xs font-bold text-slate-800">
                        {selectedResident.luas} m² - <span className="text-slate-500 font-medium">{selectedResident.dokumenTanah}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Lokasi Unit Huntap */}
                  <div className="flex items-start gap-2">
                    <Home className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] text-blue-800 uppercase font-bold">Lokasi Unit Huntap</div>
                      <div className="text-xs font-bold text-slate-800">
                        Desa Tambe, Kec. Bolo
                      </div>
                      <div className="text-[10px] text-blue-700 font-mono mt-0.5 flex items-center gap-1.5">
                        <span>{selectedResident.koordinat || 'Belum diatur'}</span>
                        {selectedResident.koordinat && (
                          <button
                            type="button"
                            onClick={() => {
                              focusOnResident(selectedResident, 'huntap');
                              setSelectedResident(null);
                              const mapEl = document.getElementById('map-container-canvas');
                              if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 font-bold cursor-pointer"
                          >
                            Pusatkan
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lokasi Tanah Asal */}
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] text-purple-800 uppercase font-bold">Lokasi Tanah Asal</div>
                      <div className="text-xs font-bold text-slate-800">
                        Desa {selectedResident.desa}, Kec. {selectedResident.kecamatan}
                      </div>
                      <div className="text-[10px] text-purple-700 font-mono mt-0.5 flex items-center gap-1.5">
                        <span>{selectedResident.koordinatAsal || 'Belum diisi'}</span>
                        {selectedResident.koordinatAsal && (
                          <button
                            type="button"
                            onClick={() => {
                              focusOnResident(selectedResident, 'asal');
                              setSelectedResident(null);
                              const mapEl = document.getElementById('map-container-canvas');
                              if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 hover:bg-purple-200 font-bold cursor-pointer"
                          >
                            Pusatkan
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Distance info badge */}
                  {calculateDistance(selectedResident.koordinat, selectedResident.koordinatAsal) && (
                    <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-100 flex items-center justify-between text-xs">
                      <span className="text-purple-900 font-bold flex items-center gap-1">
                        <Route className="h-3.5 w-3.5 text-purple-600" />
                        Jarak Relokasi: ~{calculateDistance(selectedResident.koordinat, selectedResident.koordinatAsal)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          focusOnResident(selectedResident, 'both');
                          setSelectedResident(null);
                          const mapEl = document.getElementById('map-container-canvas');
                          if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className="text-[10px] px-2 py-0.5 bg-purple-600 text-white font-bold rounded hover:bg-purple-700 cursor-pointer"
                      >
                        Lihat Jalur
                      </button>
                    </div>
                  )}

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
