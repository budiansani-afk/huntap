/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  MapPin, Globe, Layers, Check, X, Search, Compass, 
  Crosshair, Home, AlertCircle, RefreshCw, Copy
} from 'lucide-react';
import { Resident } from '../types';

interface CoordinatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (coordinate: string) => void;
  initialCoordinate?: string;
  targetType: 'huntap' | 'asal';
  residentName?: string;
  nomorRumah?: string;
  desa?: string;
  residents: Resident[];
}

export default function CoordinatePickerModal({
  isOpen,
  onClose,
  onConfirm,
  initialCoordinate = '',
  targetType,
  residentName = '',
  nomorRumah = '',
  desa = '',
  residents = []
}: CoordinatePickerModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const selectedMarkerRef = useRef<L.Marker | null>(null);
  const existingMarkersGroupRef = useRef<L.LayerGroup | null>(null);

  const [selectedCoord, setSelectedCoord] = useState<string>('');
  const [activeTile, setActiveTile] = useState<'streets' | 'satellite'>('satellite');
  const [showExistingHuntap, setShowExistingHuntap] = useState(true);
  const [showExistingAsal, setShowExistingAsal] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [geoLocating, setGeoLocating] = useState(false);
  const [geoError, setGeoError] = useState('');

  // Default coordinate: Huntap Tambe, Bolo, Bima
  const DEFAULT_LAT = -8.505668;
  const DEFAULT_LNG = 118.605591;

  // Parse initial coordinate if valid
  const parseCoord = (coordStr?: string): [number, number] | null => {
    if (!coordStr) return null;
    const parts = coordStr.split(',');
    if (parts.length === 2) {
      const lat = parseFloat(parts[0].trim());
      const lng = parseFloat(parts[1].trim());
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return [lat, lng];
      }
    }
    return null;
  };

  // Synchronize initial coordinate when modal opens
  useEffect(() => {
    if (isOpen) {
      const parsed = parseCoord(initialCoordinate);
      if (parsed) {
        setSelectedCoord(`${parsed[0].toFixed(6)}, ${parsed[1].toFixed(6)}`);
      } else {
        setSelectedCoord('');
      }
      setSearchQuery('');
      setGeoError('');
    }
  }, [isOpen, initialCoordinate]);

  // Create custom pin icon for the selected coordinate
  const createSelectedPinIcon = (isAsal: boolean) => {
    const pinColor = isAsal ? '#7c3aed' : '#2563eb';
    const ringColor = isAsal ? '#c084fc' : '#60a5fa';
    const labelText = isAsal ? 'Tanah Asal' : (nomorRumah ? `Unit ${nomorRumah}` : 'Pilihan');

    return L.divIcon({
      className: 'custom-selected-pin-marker',
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); cursor: grab;">
          <div style="background: ${pinColor}; color: white; font-size: 10px; font-weight: 800; font-family: 'Plus Jakarta Sans', sans-serif; padding: 2px 7px; border-radius: 9999px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); white-space: nowrap; margin-bottom: 2px; border: 1.5px solid white;">
            📍 ${labelText}
          </div>
          <div style="position: relative; width: 28px; height: 38px; display: flex; justify-content: center; align-items: center;">
            <svg width="28" height="38" viewBox="0 0 24 34" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 4px rgba(0,0,0,0.35));">
              <path d="M12 0C5.37258 0 0 5.37258 0 12C0 20.25 12 34 12 34C12 34 24 20.25 24 12C24 5.37258 18.6274 0 12 0Z" fill="${pinColor}"/>
              <circle cx="12" cy="12" r="5" fill="white"/>
            </svg>
          </div>
          <div style="width: 12px; height: 4px; background: rgba(0,0,0,0.35); border-radius: 50%; filter: blur(1px); margin-top: -2px;"></div>
        </div>
      `,
      iconSize: [28, 38],
      iconAnchor: [14, 38],
      popupAnchor: [0, -38]
    });
  };

  // Initialize Map inside Modal
  useEffect(() => {
    if (!isOpen) return;

    let mapInstance: L.Map | null = null;
    const container = mapContainerRef.current;
    if (!container) return;

    // Clear residual content
    container.innerHTML = '';

    const initialParsed = parseCoord(initialCoordinate);
    const startCenter: [number, number] = initialParsed 
      ? initialParsed 
      : [DEFAULT_LAT, DEFAULT_LNG];
    const startZoom = initialParsed ? 19 : 18;

    mapInstance = L.map(container, {
      center: startCenter,
      zoom: startZoom,
      zoomControl: true
    });
    mapRef.current = mapInstance;

    // Add Layer Group for Existing Reference Markers
    const existingGroup = L.layerGroup().addTo(mapInstance);
    existingMarkersGroupRef.current = existingGroup;

    // Create & place initial draggable marker if coordinate exists
    if (initialParsed) {
      const pinIcon = createSelectedPinIcon(targetType === 'asal');
      const marker = L.marker(initialParsed, {
        icon: pinIcon,
        draggable: true,
        autoPan: true
      }).addTo(mapInstance);

      marker.on('dragend', (e) => {
        const latLng = e.target.getLatLng();
        setSelectedCoord(`${latLng.lat.toFixed(6)}, ${latLng.lng.toFixed(6)}`);
      });

      selectedMarkerRef.current = marker;
    }

    // Map Click Listener to pick or move the pin
    mapInstance.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const formattedCoord = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      setSelectedCoord(formattedCoord);

      if (selectedMarkerRef.current) {
        selectedMarkerRef.current.setLatLng([lat, lng]);
      } else if (mapRef.current) {
        const pinIcon = createSelectedPinIcon(targetType === 'asal');
        const newMarker = L.marker([lat, lng], {
          icon: pinIcon,
          draggable: true,
          autoPan: true
        }).addTo(mapRef.current);

        newMarker.on('dragend', (ev) => {
          const newLatLng = ev.target.getLatLng();
          setSelectedCoord(`${newLatLng.lat.toFixed(6)}, ${newLatLng.lng.toFixed(6)}`);
        });

        selectedMarkerRef.current = newMarker;
      }
    });

    // Invalidate size once container is mounted and visible
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      selectedMarkerRef.current = null;
      existingMarkersGroupRef.current = null;
    };
  }, [isOpen]);

  // Handle Tile Layer Changes (Satellite vs Streets)
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
      maxZoom: 22,
      attribution: attribution
    }).addTo(map);
  }, [activeTile, isOpen]);

  // Render Existing Residents as Reference Markers
  useEffect(() => {
    const group = existingMarkersGroupRef.current;
    if (!group || !isOpen) return;

    group.clearLayers();

    residents.forEach((r) => {
      // 1. Reference Huntap
      if (showExistingHuntap && r.koordinat) {
        const parts = r.koordinat.split(',');
        if (parts.length === 2) {
          const lat = parseFloat(parts[0]);
          const lng = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lng)) {
            const marker = L.circleMarker([lat, lng], {
              radius: 6,
              fillColor: '#3b82f6',
              color: '#ffffff',
              weight: 1.5,
              opacity: 0.9,
              fillOpacity: 0.8
            });

            marker.bindTooltip(`
              <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px;">
                <b>Unit ${r.nomorRumah || '-'} (Huntap)</b><br/>
                ${r.nama || '-'}<br/>
                <span style="color: #2563eb; font-weight: 700;">Klik untuk gunakan titik ini</span>
              </div>
            `, { direction: 'top', opacity: 0.95 });

            marker.on('click', (e) => {
              L.DomEvent.stopPropagation(e);
              const formatted = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
              setSelectedCoord(formatted);
              if (selectedMarkerRef.current) {
                selectedMarkerRef.current.setLatLng([lat, lng]);
              } else if (mapRef.current) {
                const pinIcon = createSelectedPinIcon(targetType === 'asal');
                const newMarker = L.marker([lat, lng], {
                  icon: pinIcon,
                  draggable: true,
                  autoPan: true
                }).addTo(mapRef.current);
                newMarker.on('dragend', (ev) => {
                  const newLatLng = ev.target.getLatLng();
                  setSelectedCoord(`${newLatLng.lat.toFixed(6)}, ${newLatLng.lng.toFixed(6)}`);
                });
                selectedMarkerRef.current = newMarker;
              }
            });

            marker.addTo(group);
          }
        }
      }

      // 2. Reference Tanah Asal
      if (showExistingAsal && r.koordinatAsal) {
        const partsA = r.koordinatAsal.split(',');
        if (partsA.length === 2) {
          const latA = parseFloat(partsA[0]);
          const lngA = parseFloat(partsA[1]);
          if (!isNaN(latA) && !isNaN(lngA)) {
            const markerA = L.circleMarker([latA, lngA], {
              radius: 6,
              fillColor: '#8b5cf6',
              color: '#ffffff',
              weight: 1.5,
              opacity: 0.9,
              fillOpacity: 0.8
            });

            markerA.bindTooltip(`
              <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px;">
                <b>📍 Asal: Unit ${r.nomorRumah || '-'}</b><br/>
                ${r.nama || '-'} (Desa ${r.desa || '-'})<br/>
                <span style="color: #7c3aed; font-weight: 700;">Klik untuk gunakan titik ini</span>
              </div>
            `, { direction: 'top', opacity: 0.95 });

            markerA.on('click', (e) => {
              L.DomEvent.stopPropagation(e);
              const formatted = `${latA.toFixed(6)}, ${lngA.toFixed(6)}`;
              setSelectedCoord(formatted);
              if (selectedMarkerRef.current) {
                selectedMarkerRef.current.setLatLng([latA, lngA]);
              } else if (mapRef.current) {
                const pinIcon = createSelectedPinIcon(targetType === 'asal');
                const newMarker = L.marker([latA, lngA], {
                  icon: pinIcon,
                  draggable: true,
                  autoPan: true
                }).addTo(mapRef.current);
                newMarker.on('dragend', (ev) => {
                  const newLatLng = ev.target.getLatLng();
                  setSelectedCoord(`${newLatLng.lat.toFixed(6)}, ${newLatLng.lng.toFixed(6)}`);
                });
                selectedMarkerRef.current = newMarker;
              }
            });

            markerA.addTo(group);
          }
        }
      }
    });
  }, [residents, showExistingHuntap, showExistingAsal, isOpen, targetType, nomorRumah]);

  // Handle Current Device Location Detection
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      setGeoError('Perangkat atau browser tidak mendukung fitur geolokasi GPS.');
      return;
    }

    setGeoLocating(true);
    setGeoError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const formatted = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setSelectedCoord(formatted);

        const map = mapRef.current;
        if (map) {
          map.flyTo([lat, lng], 19, { animate: true, duration: 1 });
          if (selectedMarkerRef.current) {
            selectedMarkerRef.current.setLatLng([lat, lng]);
          } else {
            const pinIcon = createSelectedPinIcon(targetType === 'asal');
            const newMarker = L.marker([lat, lng], {
              icon: pinIcon,
              draggable: true,
              autoPan: true
            }).addTo(map);
            newMarker.on('dragend', (ev) => {
              const newLatLng = ev.target.getLatLng();
              setSelectedCoord(`${newLatLng.lat.toFixed(6)}, ${newLatLng.lng.toFixed(6)}`);
            });
            selectedMarkerRef.current = newMarker;
          }
        }
      },
      (err) => {
        setGeoLocating(false);
        setGeoError(`Gagal mendeteksi lokasi GPS: ${err.message}. Pastikan izin lokasi aktif.`);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Center on Huntap Tambe
  const handleCenterHuntapTambe = () => {
    if (mapRef.current) {
      mapRef.current.flyTo([DEFAULT_LAT, DEFAULT_LNG], 18, { animate: true, duration: 0.8 });
    }
  };

  // Search filter for quick jump
  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return residents.filter(r => 
      (r.nama && r.nama.toLowerCase().includes(q)) ||
      (r.nomorRumah && r.nomorRumah.toLowerCase().includes(q)) ||
      (r.nik && r.nik.includes(q)) ||
      (r.desa && r.desa.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [residents, searchQuery]);

  // Jump to searched resident's location
  const handleSelectSearchResult = (r: Resident) => {
    const coordStr = targetType === 'asal' ? (r.koordinatAsal || r.koordinat) : (r.koordinat || r.koordinatAsal);
    const parsed = parseCoord(coordStr);
    if (parsed && mapRef.current) {
      mapRef.current.flyTo(parsed, 19, { animate: true, duration: 1 });
      const formatted = `${parsed[0].toFixed(6)}, ${parsed[1].toFixed(6)}`;
      setSelectedCoord(formatted);
      if (selectedMarkerRef.current) {
        selectedMarkerRef.current.setLatLng(parsed);
      } else {
        const pinIcon = createSelectedPinIcon(targetType === 'asal');
        const newMarker = L.marker(parsed, {
          icon: pinIcon,
          draggable: true,
          autoPan: true
        }).addTo(mapRef.current);
        newMarker.on('dragend', (ev) => {
          const newLatLng = ev.target.getLatLng();
          setSelectedCoord(`${newLatLng.lat.toFixed(6)}, ${newLatLng.lng.toFixed(6)}`);
        });
        selectedMarkerRef.current = newMarker;
      }
      setSearchQuery('');
    }
  };

  const handleCopyCoord = () => {
    if (!selectedCoord) return;
    navigator.clipboard.writeText(selectedCoord);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Confirm and return to form
  const handleConfirmSelection = () => {
    if (!selectedCoord) return;
    onConfirm(selectedCoord);
    onClose();
  };

  if (!isOpen) return null;

  const isAsal = targetType === 'asal';

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isAsal ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-blue-100 text-blue-800 border border-blue-200'
              }`}>
                {isAsal ? 'Titik Lokasi Tanah Asal' : 'Titik Unit Hunian Tetap (Huntap)'}
              </span>
              {(nomorRumah || residentName) && (
                <span className="text-[11px] font-bold text-slate-500">
                  {nomorRumah ? `Unit ${nomorRumah}` : ''} {residentName ? `• ${residentName}` : ''}
                </span>
              )}
            </div>
            <h3 className="font-black text-slate-800 text-base sm:text-lg flex items-center gap-2">
              <Compass className={`h-5 w-5 ${isAsal ? 'text-purple-600' : 'text-blue-600'}`} />
              Ambil Koordinat dari Peta Sebaran
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Klik pada peta atau geser pin penanda untuk menentukan lokasi presisi, lalu klik <b>Gunakan Titik Ini</b> untuk mengisi form.
            </p>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition cursor-pointer shrink-0"
            title="Tutup Modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar Controls Above Map */}
        <div className="px-4 py-2.5 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Left Controls: Basemaps & Quick Action */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="bg-slate-100 p-0.5 rounded-xl flex items-center gap-0.5 border border-slate-200">
              <button 
                type="button"
                onClick={() => setActiveTile('satellite')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer ${
                  activeTile === 'satellite' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="h-3 w-3" /> Satelit
              </button>
              <button 
                type="button"
                onClick={() => setActiveTile('streets')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer ${
                  activeTile === 'streets' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="h-3 w-3" /> Jalan
              </button>
            </div>

            <button 
              type="button"
              onClick={handleDetectGPS}
              disabled={geoLocating}
              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
              title="Deteksi lokasi GPS perangkat saya saat ini"
            >
              {geoLocating ? (
                <RefreshCw className="h-3 w-3 animate-spin text-blue-600" />
              ) : (
                <Crosshair className="h-3 w-3 text-blue-600" />
              )}
              <span>{geoLocating ? 'Mendeteksi...' : 'GPS Saya'}</span>
            </button>

            <button 
              type="button"
              onClick={handleCenterHuntapTambe}
              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
              title="Pusatkan peta ke Kawasan Huntap Tambe"
            >
              <Home className="h-3 w-3 text-orange-600" />
              <span className="hidden sm:inline">Huntap Tambe</span>
            </button>

            {/* Reference Toggles */}
            <button 
              type="button"
              onClick={() => setShowExistingHuntap(!showExistingHuntap)}
              className={`px-2 py-1 rounded-xl font-bold text-[10px] transition cursor-pointer ${
                showExistingHuntap ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-400 line-through'
              }`}
              title="Tampilkan titik referensi unit huntap lain"
            >
              ● Unit Huntap
            </button>

            <button 
              type="button"
              onClick={() => setShowExistingAsal(!showExistingAsal)}
              className={`px-2 py-1 rounded-xl font-bold text-[10px] transition cursor-pointer ${
                showExistingAsal ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-slate-100 text-slate-400 line-through'
              }`}
              title="Tampilkan titik referensi tanah asal lain"
            >
              ● Tanah Asal
            </button>
          </div>

          {/* Right Search Input for Quick Reference */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari referensi (Nama/Unit/Desa)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-400 font-semibold"
            />
            {searchQuery && (
              <button 
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}

            {/* Quick Search Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 divide-y divide-slate-100 overflow-hidden">
                {searchResults.map((sr) => (
                  <button
                    key={sr.id}
                    type="button"
                    onClick={() => handleSelectSearchResult(sr)}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-[11px] flex items-center justify-between transition cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-slate-800">Unit {sr.nomorRumah || '-'}</span>
                      <span className="text-slate-500 ml-1.5">• {sr.nama}</span>
                    </div>
                    <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      Ke Titik
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* GPS Error Alert if any */}
        {geoError && (
          <div className="px-4 py-1.5 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>{geoError}</span>
          </div>
        )}

        {/* Interactive Leaflet Map Canvas */}
        <div className="relative flex-1 min-h-[380px] sm:min-h-[440px] w-full bg-slate-100">
          <div ref={mapContainerRef} className="absolute inset-0 h-full w-full z-10"></div>

          {/* Floating Instructions Badge */}
          <div className="absolute top-3 left-3 z-20 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-slate-200 shadow-md text-[11px] font-semibold text-slate-700 flex items-center gap-2 pointer-events-none">
            <span className={`w-2.5 h-2.5 rounded-full animate-ping ${isAsal ? 'bg-purple-600' : 'bg-blue-600'}`}></span>
            <span>Klik titik mana pun pada peta atau geser pin untuk menetapkan koordinat.</span>
          </div>
        </div>

        {/* Modal Footer / Action Bar */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Coordinates readout */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className={`px-3 py-2 rounded-2xl border flex items-center gap-2 w-full sm:w-auto ${
              selectedCoord 
                ? (isAsal ? 'bg-purple-50 border-purple-200 text-purple-950' : 'bg-blue-50 border-blue-200 text-blue-950')
                : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}>
              <MapPin className={`h-4 w-4 shrink-0 ${
                selectedCoord ? (isAsal ? 'text-purple-600' : 'text-blue-600') : 'text-slate-400'
              }`} />
              <div className="text-left">
                <div className="text-[9px] uppercase font-extrabold tracking-wider opacity-70">
                  {isAsal ? 'Koordinat Tanah Asal Terpilih' : 'Koordinat Huntap Terpilih'}
                </div>
                <div className="font-mono text-xs sm:text-sm font-bold truncate">
                  {selectedCoord || 'Belum ada titik yang dipilih (klik pada peta)'}
                </div>
              </div>
              {selectedCoord && (
                <button
                  type="button"
                  onClick={handleCopyCoord}
                  className="p-1 rounded-md hover:bg-white/80 text-slate-500 hover:text-slate-800 transition ml-auto cursor-pointer"
                  title="Salin Koordinat"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              )}
              {copied && <span className="text-[10px] font-bold text-emerald-600">Disalin!</span>}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer"
            >
              Batal
            </button>

            <button
              type="button"
              disabled={!selectedCoord}
              onClick={handleConfirmSelection}
              className={`px-5 py-2.5 rounded-2xl font-bold text-xs text-white transition flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isAsal ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Check className="h-4 w-4" />
              <span>Gunakan Koordinat Ini & Kembali</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
