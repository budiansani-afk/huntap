/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Globe, Compass, Home, Layers, Check, Info } from 'lucide-react';
import { Resident } from '../types';

interface PetaSebaranProps {
  residents: Resident[];
  locateResident: Resident | null;
  onClearLocate: () => void;
}

export default function PetaSebaran({ residents, locateResident, onClearLocate }: PetaSebaranProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const [activeTile, setActiveTile] = useState<'streets' | 'satellite'>('satellite');

  // Coordinates of Bolo, Bima, NTB
  const DEFAULT_LAT = -8.4419;
  const DEFAULT_LNG = 118.6253;
  const DEFAULT_ZOOM = 15;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Create Leaflet Map Instance
    const mapInstance = L.map(mapContainerRef.current, {
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
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
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

    residents.forEach((r) => {
      if (!r.koordinat) return;

      const parts = r.koordinat.split(',');
      if (parts.length !== 2) return;

      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);

      if (isNaN(lat) || isNaN(lng)) return;

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

      // Customized interactive popup
      const popupContent = `
        <div style="font-family: 'Inter', sans-serif; padding: 6px; width: 180px;">
          <div style="background-color: #eff6ff; color: #1e3a8a; font-weight: 800; font-size: 11px; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 6px;">
            Unit ${r.nomorRumah}
          </div>
          <div style="font-weight: 800; font-size: 13px; color: #1f2937; margin-bottom: 2px;">${r.nama}</div>
          <div style="font-size: 10px; color: #6b7280; margin-bottom: 4px;">Desa ${r.desa}, Bolo</div>
          <div style="border-top: 1px solid #e5e7eb; padding-top: 4px; margin-top: 4px; font-size: 10px;">
            <strong>Status:</strong> <span style="color: ${color}; font-weight: 700;">${statusLabel}</span>
          </div>
          ${r.noHp ? `<div style="font-size: 10px; margin-top: 2px;"><strong>WA:</strong> ${r.noHp}</div>` : ''}
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.addTo(markersGroup);
    });

  }, [residents]);

  // Handle outside pan/locate events (e.g. from table selection)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !locateResident || !locateResident.koordinat) return;

    const parts = locateResident.koordinat.split(',');
    if (parts.length !== 2) return;

    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);

    if (!isNaN(lat) && !isNaN(lng)) {
      map.flyTo([lat, lng], 18, {
        animate: true,
        duration: 1.5
      });

      // Automatically open popup of located marker after flying
      setTimeout(() => {
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
          .openOn(map);
      }, 1600);
    }

    onClearLocate();
  }, [locateResident, onClearLocate]);

  const handleResetView = () => {
    const map = mapRef.current;
    if (!map) return;
    map.setView([DEFAULT_LAT, DEFAULT_LNG], DEFAULT_ZOOM);
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
            onClick={handleResetView}
            className="px-4 py-2 rounded-xl bg-pastel-brown-light hover:bg-orange-100/40 border border-orange-100 text-pastel-orange font-bold text-xs transition"
          >
            Reset Fokus
          </button>
        </div>
      </div>

      {/* Actual Map Canvas container */}
      <div className="bg-white p-2 rounded-3xl border border-slate-100 shadow-xs overflow-hidden relative">
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
    </div>
  );
}
