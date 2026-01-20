// src/components/ImpactDashboard.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import Papa from "papaparse";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Custom marker icon
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Fix Leaflet marker icons for Vite/React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ---------------------------
// Your Google Sheets CSV URLs (already set)
const METRICS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRU9N7l6y2kzhAMtCg74nXA0T8aDfGvQBkac0RipVZsWRqyqof_66n6u-EP8Tr3sQTloEgz0n2Bn59y/pub?gid=0&single=true&output=csv";
const TREND_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRU9N7l6y2kzhAMtCg74nXA0T8aDfGvQBkac0RipVZsWRqyqof_66n6u-EP8Tr3sQTloEgz0n2Bn59y/pub?gid=1901505649&single=true&output=csv";
const LOCATIONS_CSV_URL = "";
const BENEFICIARIES_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRU9N7l6y2kzhAMtCg74nXA0T8aDfGvQBkac0RipVZsWRqyqof_66n6u-EP8Tr3sQTloEgz0n2Bn59y/pub?gid=2007485460&single=true&output=csv";
// ---------------------------

// Canonical province coordinates (one pin per province)
const REGION_COORDS = {
  "Gauteng": { lat: -26.2708, lng: 28.1123 },
  "KwaZulu-Natal": { lat: -29.0, lng: 31.0 },
  "Western Cape": { lat: -33.9249, lng: 18.4241 },
  "Eastern Cape": { lat: -32.2968, lng: 26.4194 },
  "Northern Cape": { lat: -29.0467, lng: 21.8569 },
  "Free State": { lat: -28.4541, lng: 26.7968 },
  "North West": { lat: -26.6639, lng: 25.2838 },
  "Limpopo": { lat: -23.401, lng: 29.4179 },
  "Mpumalanga": { lat: -25.5653, lng: 30.527 },
};

// Some common aliases → canonical region name (lowercased keys)
const REGION_ALIASES = {
  "gauteng": "Gauteng",
  "gp": "Gauteng",
  "kwazulu-natal": "KwaZulu-Natal",
  "kwazulu natal": "KwaZulu-Natal",
  "kzn": "KwaZulu-Natal",
  "western cape": "Western Cape",
  "wc": "Western Cape",
  "eastern cape": "Eastern Cape",
  "ec": "Eastern Cape",
  "northern cape": "Northern Cape",
  "n cape": "Northern Cape",
  "free state": "Free State",
  "fs": "Free State",
  "north west": "North West",
  "north-west": "North West",
  "nw": "North West",
  "limpopo": "Limpopo",
  "mpumalanga": "Mpumalanga",
};

// Normalize region string: trim, lowercase, collapse spaces/hyphens
function normalizeKey(s) {
  if (!s && s !== 0) return "";
  return String(s).trim().toLowerCase().replace(/[_]+/g, " ").replace(/[-]+/g, " ").replace(/\s+/g, " ");
}

// Map any entered region to canonical province name (fallback: title-case input)
function canonicalRegionName(raw) {
  const key = normalizeKey(raw);
  if (!key) return "";
  if (REGION_ALIASES[key]) return REGION_ALIASES[key];
  // if it matches canonical keys (lowercased)
  for (const canon of Object.keys(REGION_COORDS)) {
    if (normalizeKey(canon) === key) return canon;
  }
  // fallback: title-case the input (so it still groups)
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// Helper - safe compare of region names
function sameRegion(a, b) {
  return normalizeKey(a) === normalizeKey(b);
}

// Simple stat card
function StatCard({ label, value }) {
  return (
    <div className="bg-gradient-to-br from-white to-blue-50/80 shadow-2xl rounded-2xl p-6 flex flex-col justify-between transition-all duration-500 hover:shadow-3xl hover:scale-[1.03] hover:bg-gradient-to-br hover:from-blue-100 hover:to-white border border-blue-200/50 hover:border-blue-400 group backdrop-blur-sm">
      <div className="text-sm font-semibold uppercase tracking-wider text-blue-600/80 group-hover:text-blue-700 transition-colors duration-300">
        {label}
      </div>
      <div className="text-4xl font-black mt-4 bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent group-hover:from-blue-700 group-hover:to-cyan-600 transition-all duration-500">
        {value}
      </div>
      <div className="mt-4 h-1 w-12 bg-gradient-to-r from-blue-400 to-cyan-300 rounded-full group-hover:w-16 transition-all duration-500"></div>
    </div>
  );
}

export default function ImpactDashboard() {
  const [stats, setStats] = useState({});
  const [trendData, setTrendData] = useState([]);
  const [locations, setLocations] = useState([]); // pins generated from beneficiaries
  const [beneficiaries, setBeneficiaries] = useState([]); // all beneficiaries
  const [loading, setLoading] = useState(true);

  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        // fetch CSVs
        const [metricsResp, trendResp, locationsResp, beneficiariesResp] =
          await Promise.all([
            axios.get(METRICS_CSV_URL),
            axios.get(TREND_CSV_URL),
            axios.get(LOCATIONS_CSV_URL).catch(() => ({ data: "" })), // optional
            axios.get(BENEFICIARIES_CSV_URL),
          ]);

        const metricsRows = Papa.parse(metricsResp.data || "", {
          header: true,
          dynamicTyping: true,
        }).data;
        const trendRows = Papa.parse(trendResp.data || "", {
          header: true,
          dynamicTyping: true,
        }).data;
        // locations sheet may be unused — we prefer BENEFICIARIES' region column
        const locationRows = Papa.parse(locationsResp.data || "", {
          header: true,
          dynamicTyping: true,
        }).data;
        const beneficiaryRows = Papa.parse(beneficiariesResp.data || "", {
          header: true,
          dynamicTyping: true,
        }).data;

        // Build stats
        const buildStats = {
          smesSupported:
            Number(
              metricsRows.find((r) => (r.metric || "").toLowerCase() === "smes")
                ?.value
            ) || 0,
          youthTrained:
            Number(
              metricsRows.find((r) => (r.metric || "").toLowerCase() === "youth")
                ?.value
            ) || 0,
          jobsCreated:
            Number(
              metricsRows.find((r) => (r.metric || "").toLowerCase() === "jobs")
                ?.value
            ) || 0,
          businessesFunded:
            Number(
              metricsRows.find(
                (r) => (r.metric || "").toLowerCase() === "funded"
              )?.value
            ) || 0,
        };

        // Trend
        const trendFromSheet = (trendRows || [])
          .filter((r) => r && r.period)
          .map((r) => ({
            period: r.period,
            smes: Number(r.smes) || 0,
            youth: Number(r.youth) || 0,
            jobs: Number(r.jobs) || 0,
          }));

        // Process beneficiaries: normalize their region to canonicalRegion
        const bens = (beneficiaryRows || [])
          .filter((r) => r && (r.region || r.Region) && (r.name || r.Name || r.beneficiary))
          .map((r, i) => {
            const rawRegion = r.region || r.Region || r.RegionName || r.province || "";
            const canonical = canonicalRegionName(rawRegion);
            return {
              id: i + 1,
              rawRegion: rawRegion,
              region: canonical,
              name: r.name || r.Name || r.beneficiary || r["business name"] || `Business ${i + 1}`,
              description: r.description || r.profile || r.about || "",
              website: r.website || r.site || "",
              image: r.image || r.photo || r.photo_url || "",
              profile: r.profile || r["company profile"] || r["Company Profile"] || "",
            };
          });

        // Build unique regions from beneficiaries (preferred)
        const regionMap = {};
        bens.forEach((b) => {
          const key = normalizeKey(b.region || "");
          if (!regionMap[key]) {
            // choose coords from REGION_COORDS if available
            const canon = b.region;
            const coords = REGION_COORDS[canon] || { lat: -28.4793, lng: 24.6727 };
            regionMap[key] = {
              id: Object.keys(regionMap).length + 1,
              name: canon,
              lat: coords.lat,
              lng: coords.lng,
              beneficiaries: [],
            };
          }
          regionMap[key].beneficiaries.push(b);
        });

        // Also optionally include any regions from Locations sheet (if they include provinces)
        (locationRows || []).forEach((r) => {
          const rawRegion = r.region || r.name || r.Region || "";
          if (!rawRegion) return;
          const canon = canonicalRegionName(rawRegion);
          const key = normalizeKey(canon);
          if (!regionMap[key]) {
            const coords = REGION_COORDS[canon] || { lat: -28.4793, lng: 24.6727 };
            regionMap[key] = {
              id: Object.keys(regionMap).length + 1,
              name: canon,
              lat: coords.lat,
              lng: coords.lng,
              beneficiaries: [],
            };
          } // if location sheet has extra info we could merge later
        });

        const locsArray = Object.values(regionMap);

        if (!mounted) return;
        setStats(buildStats);
        setTrendData(trendFromSheet);
        setBeneficiaries(bens);
        setLocations(locsArray);

        // debug logs (helpful during testing)
        // eslint-disable-next-line no-console
        console.log("Loaded beneficiaries:", bens);
        // eslint-disable-next-line no-console
        console.log("Generated locations (pins):", locsArray);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 60000);
    return () => {
      clearInterval(interval);
      mounted = false;
    };
  }, []);

  // Beneficiaries for selected region (safe compare)
  const regionBeneficiaries = beneficiaries.filter((b) =>
    sameRegion(b.region, selectedRegion)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-4 md:p-8">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-300/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-300/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/3 w-60 h-60 bg-blue-400/5 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <header className="mb-12 flex flex-col items-center">
          {/* Animated logo container */}
          <div className="relative mb-6 group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-2xl blur-xl opacity-50 group-hover:opacity-70 transition-opacity duration-500"></div>
            <img 
              src="/logo-B.svg" 
              alt="Logo" 
              className="h-20 mb-4 relative transition-all duration-500 hover:scale-110 hover:rotate-3" 
            />
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black text-center mb-4">
            <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-700 bg-clip-text text-transparent animate-gradient-x">
              Brandscapers Africa
            </span>
          </h1>
          <p className="text-lg md:text-xl text-blue-600/80 text-center max-w-3xl">
            <span className="bg-gradient-to-r from-blue-600/90 to-cyan-500/90 bg-clip-text text-transparent font-semibold">
              Impact Tracker Dashboard
            </span>
            <span className="block text-sm md:text-base text-blue-500/70 font-normal mt-2">
              Live insights on SME empowerment, youth development, and economic growth across South Africa
            </span>
          </p>
        </header>

        {/* Stat cards with enhanced design */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard label="SMEs Supported" value={loading ? "—" : stats.smesSupported.toLocaleString()} />
          <StatCard label="Youth Trained" value={loading ? "—" : stats.youthTrained.toLocaleString()} />
          <StatCard label="Jobs Created" value={loading ? "—" : stats.jobsCreated.toLocaleString()} />
          <StatCard label="Businesses Funded" value={loading ? "—" : stats.businessesFunded.toLocaleString()} />
        </section>

        {/* Charts + Map with modern styling */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Chart 1 */}
          <div className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-2xl border border-white/20 transition-all duration-500 hover:shadow-3xl hover:scale-[1.01] group">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                Progress Timeline
              </h3>
              <span className="text-xs font-semibold bg-blue-100 text-blue-600 px-3 py-1 rounded-full">
                LIVE TRACKING
              </span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
                  <XAxis 
                    dataKey="period" 
                    stroke="#4a5568" 
                    fontSize={12}
                    tick={{ fill: '#4a5568' }}
                  />
                  <YAxis 
                    stroke="#4a5568" 
                    fontSize={12}
                    tick={{ fill: '#4a5568' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                      padding: '12px'
                    }} 
                    labelStyle={{ color: '#1e40af', fontWeight: 'bold' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="smes" 
                    name="SMEs Supported"
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#3b82f6' }}
                    activeDot={{ r: 8, fill: '#1d4ed8' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="youth" 
                    name="Youth Trained"
                    stroke="#10b981" 
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#10b981' }}
                    activeDot={{ r: 8, fill: '#059669' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="jobs" 
                    name="Jobs Created"
                    stroke="#f59e0b" 
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#f59e0b' }}
                    activeDot={{ r: 8, fill: '#d97706' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Map */}
          <div className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-2xl border border-white/20 transition-all duration-500 hover:shadow-3xl hover:scale-[1.01] group">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                Geographic Impact
              </h3>
              <span className="text-xs font-semibold bg-green-100 text-green-600 px-3 py-1 rounded-full">
                {locations.length} PROVINCES
              </span>
            </div>
            <div className="h-72 rounded-2xl overflow-hidden shadow-inner transition-all duration-500 group-hover:shadow-xl">
              <MapContainer
                center={[-28.4793, 24.6727]}
                zoom={5}
                style={{ height: "100%", width: "100%" }}
                className="rounded-2xl"
              >
                <TileLayer 
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; OpenStreetMap contributors &copy; CARTO'
                />
                {locations.map((loc) => (
                  <Marker
                    key={loc.id}
                    position={[loc.lat, loc.lng]}
                    icon={customIcon}
                    eventHandlers={{ 
                      click: () => setSelectedRegion(loc.name),
                      mouseover: (e) => e.target.openPopup(),
                      mouseout: (e) => e.target.closePopup()
                    }}
                  >
                    <Popup className="rounded-xl shadow-xl border border-blue-100">
                      <div className="p-3 min-w-[200px]">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          <strong className="text-blue-800 text-lg">{loc.name}</strong>
                        </div>
                        <div className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full inline-block mb-3">
                          {loc.beneficiaries.length} beneficiaries
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          {loc.beneficiaries.slice(0, 3).map((b, idx) => (
                            <div key={b.id} className="flex items-center gap-2">
                              <span className="text-blue-500">•</span>
                              <span className="truncate">{b.name}</span>
                            </div>
                          ))}
                          {loc.beneficiaries.length > 3 && (
                            <div className="text-blue-500 text-xs font-medium pt-1">
                              +{loc.beneficiaries.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
            <div className="mt-4 text-sm text-blue-600/70 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Click on any province to explore beneficiaries
            </div>
          </div>

          {/* Bar Chart - Full width */}
          <div className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-2xl border border-white/20 transition-all duration-500 hover:shadow-3xl hover:scale-[1.01] lg:col-span-2 group">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                Program Performance Breakdown
              </h3>
              <span className="text-xs font-semibold bg-purple-100 text-purple-600 px-3 py-1 rounded-full">
                QUARTERLY ANALYSIS
              </span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
                  <XAxis 
                    dataKey="period" 
                    stroke="#4a5568" 
                    fontSize={12}
                    tick={{ fill: '#4a5568' }}
                  />
                  <YAxis 
                    stroke="#4a5568" 
                    fontSize={12}
                    tick={{ fill: '#4a5568' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                      padding: '12px'
                    }}
                    labelStyle={{ color: '#1e40af', fontWeight: 'bold' }}
                  />
                  <Legend />
                  <Bar dataKey="smes" name="SMEs Supported" radius={[8, 8, 0, 0]}>
                    {trendData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#3b82f6' : '#60a5fa'} />
                    ))}
                  </Bar>
                  <Bar dataKey="youth" name="Youth Trained" radius={[8, 8, 0, 0]}>
                    {trendData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#10b981' : '#34d399'} />
                    ))}
                  </Bar>
                  <Bar dataKey="jobs" name="Jobs Created" radius={[8, 8, 0, 0]}>
                    {trendData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#f59e0b' : '#fbbf24'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Beneficiaries List */}
        {selectedRegion && !selectedBeneficiary && (
          <section className="bg-gradient-to-br from-white/95 to-blue-50/95 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/20 transition-all duration-500 mb-10 hover:shadow-3xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
              <div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                  Beneficiaries in {selectedRegion}
                </h3>
                <p className="text-blue-600/70 text-sm mt-2">
                  {regionBeneficiaries.length} {regionBeneficiaries.length === 1 ? 'business' : 'businesses'} impacting the community
                </p>
              </div>
              <div className="flex gap-3">
                <button 
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded-xl hover:from-blue-600 hover:to-cyan-500 transition-all duration-300 hover:shadow-lg active:scale-95 font-medium"
                  onClick={() => setSelectedRegion(null)}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Close View
                  </span>
                </button>
              </div>
            </div>

            {regionBeneficiaries.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <p className="text-gray-500 text-lg">No beneficiaries registered for this province yet</p>
                <p className="text-gray-400 text-sm mt-2">Check back soon for updates</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {regionBeneficiaries.map((b) => (
                  <div
                    key={b.id}
                    className="bg-gradient-to-br from-white to-blue-50/50 border border-blue-100/50 rounded-2xl p-5 shadow-lg cursor-pointer transition-all duration-400 hover:shadow-2xl hover:scale-[1.02] hover:border-blue-300/50 hover:bg-gradient-to-br hover:from-blue-50 hover:to-white group"
                    onClick={() => setSelectedBeneficiary(b)}
                  >
                    <div className="relative overflow-hidden rounded-xl mb-4">
                      {b.image ? (
                        <img 
                          src={b.image} 
                          alt={b.name} 
                          className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-110" 
                        />
                      ) : (
                        <div className="w-full h-48 bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center">
                          <svg className="w-16 h-16 text-blue-300" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                    <h4 className="font-bold text-lg text-blue-900 group-hover:text-blue-800 transition-colors duration-300">
                      {b.name}
                    </h4>
                    <p className="text-sm text-gray-600 line-clamp-2 mt-2 group-hover:text-gray-800 transition-colors duration-300">
                      {b.description || "Making an impact in the community"}
                    </p>
                    {(b.website || b.profile) && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {b.website && (
                          <a
                            href={b.website.startsWith("http") ? b.website : `https://${b.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:from-blue-200 hover:to-blue-100 transition-all duration-300 hover:shadow-md border border-blue-200 hover:border-blue-300 font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                              </svg>
                              Website
                            </span>
                          </a>
                        )}
                        {b.profile && (
                          <a
                            href={b.profile}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs bg-gradient-to-r from-green-100 to-green-50 text-green-700 px-3 py-1.5 rounded-lg hover:from-green-200 hover:to-green-100 transition-all duration-300 hover:shadow-md border border-green-200 hover:border-green-300 font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                              </svg>
                              Profile
                            </span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Beneficiary Profile */}
        {selectedBeneficiary && (
          <section className="bg-gradient-to-br from-white/95 to-blue-50/95 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/20 transition-all duration-500 mb-10 hover:shadow-3xl">
            <button 
              className="px-4 py-2 bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 rounded-xl hover:from-blue-200 hover:to-blue-100 transition-all duration-300 hover:shadow-md border border-blue-200 hover:border-blue-300 mb-6 font-medium"
              onClick={() => setSelectedBeneficiary(null)}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to {selectedRegion} beneficiaries
              </span>
            </button>
            
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="lg:w-1/3">
                <div className="relative overflow-hidden rounded-2xl shadow-xl">
                  {selectedBeneficiary.image ? (
                    <img 
                      src={selectedBeneficiary.image} 
                      alt={selectedBeneficiary.name} 
                      className="w-full h-64 lg:h-80 object-cover transition-transform duration-700 hover:scale-105" 
                    />
                  ) : (
                    <div className="w-full h-64 lg:h-80 bg-gradient-to-br from-blue-200 to-cyan-200 flex items-center justify-center">
                      <div className="text-center">
                        <svg className="w-20 h-20 text-blue-500 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                        </svg>
                        <p className="text-blue-700 font-medium">Company Profile</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-4">
                    <div className="text-white font-semibold text-lg">{selectedBeneficiary.name}</div>
                  </div>
                </div>
              </div>
              
              <div className="lg:w-2/3">
                <div className="mb-6">
                  <div className="inline-block bg-gradient-to-r from-blue-500 to-cyan-400 text-white px-4 py-1.5 rounded-full text-sm font-semibold mb-3">
                    {selectedBeneficiary.region}
                  </div>
                  <h3 className="text-3xl font-bold text-blue-900 mb-4">{selectedBeneficiary.name}</h3>
                  <p className="text-gray-700 text-lg leading-relaxed">{selectedBeneficiary.description || "This business is making significant contributions to the local economy and community development."}</p>
                </div>
                
                {(selectedBeneficiary.website || selectedBeneficiary.profile) && (
                  <div className="flex flex-wrap gap-4 mt-8">
                    {selectedBeneficiary.website && (
                      <a
                        href={selectedBeneficiary.website.startsWith("http") ? selectedBeneficiary.website : `https://${selectedBeneficiary.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 hover:shadow-xl active:scale-95 font-medium"
                      >
                        <span className="flex items-center gap-3">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                          </svg>
                          Visit Official Website
                        </span>
                      </a>
                    )}
                    {selectedBeneficiary.profile && (
                      <a
                        href={selectedBeneficiary.profile}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-300 hover:shadow-xl active:scale-95 font-medium"
                      >
                        <span className="flex items-center gap-3">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm4 14a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                          View Full Company Profile
                        </span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center pt-8 border-t border-blue-100/50 mt-12">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"></div>
              <div className="text-sm text-blue-600/70">
                Built with ❤️ for <span className="font-semibold text-blue-700">Brandscapers Africa</span>
              </div>
              <div className="w-3 h-3 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"></div>
            </div>
            <p className="text-xs text-blue-500/60">
              Impact Tracker Dashboard • Real-time insights for economic empowerment • {new Date().getFullYear()}
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}