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
} from "recharts";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet marker icons for Vite/React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ---------------------------
// Your Google Sheets CSV URLs (already set)
const METRICS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRU9N7l6y2kzhAMtCg74nXA0T8aDfGvQBkac0RipVZsWRqyqof_66n6u-EP8Tr3sQTloEgz0n2Bn59y/pub?gid=0&single=true&output=csv";
const TREND_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRU9N7l6y2kzhAMtCg74nXA0T8aDfGvQBkac0RipVZsWRqyqof_66n6u-EP8Tr3sQTloEgz0n2Bn59y/pub?gid=1901505649&single=true&output=csv";
const LOCATIONS_CSV_URL =
  "";
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
    <div className="bg-white bg-opacity-90 backdrop-blur-sm shadow-lg rounded-xl p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:scale-[1.02] hover:bg-blue-100 border border-blue-100">
      <div className="text-sm font-medium text-blue-600">{label}</div>
      <div className="text-2xl font-bold mt-2 text-blue-800">{value}</div>
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex flex-col items-center">
          {/* optional: replace with your logo path */}
          <img src="/logo-B.svg" alt="Logo" className="h-16 mb-4" /> 
          <h1 className="text-3xl font-bold text-blue-800 text-center">
            Brandscapers Africa — Impact Tracker Dashboard
          </h1>
          <p className="text-md text-blue-600 text-center mt-2">
            Live snapshot of SMEs supported, youth trained, jobs created and businesses funded
          </p>
        </header>

        {/* Stat cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard label="SMEs Supported" value={loading ? "—" : stats.smesSupported} />
          <StatCard label="SMEs Trained" value={loading ? "—" : stats.youthTrained} />
          <StatCard label="Jobs Created" value={loading ? "—" : stats.jobsCreated} />
          
<StatCard
 label="Youth Trained"
  value={loading ? "—" : stats.businessesFunded}
 />
        </section>

        {/* Charts + Map */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white bg-opacity-90 backdrop-blur-sm p-5 rounded-xl shadow-lg border border-blue-100 transition-all duration-300 hover:shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-blue-800">Progress Over Time</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="period" stroke="#4a5568" />
                  <YAxis stroke="#4a5568" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #bee3f8',
                      borderRadius: '0.5rem'
                    }} 
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="smes" 
                    stroke="#4c51bf" 
                    strokeWidth={2}
                    activeDot={{ r: 6, fill: '#4c51bf' }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="SME Trained" 
                    stroke="#38a169" 
                    strokeWidth={2}
                    activeDot={{ r: 6, fill: '#38a169' }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="jobs" 
                    stroke="#dd6b20" 
                    strokeWidth={2}
                    activeDot={{ r: 6, fill: '#dd6b20' }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white bg-opacity-90 backdrop-blur-sm p-5 rounded-xl shadow-lg border border-blue-100 transition-all duration-300 hover:shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-blue-800">Geography & Events</h3>
            <div className="h-72 rounded-lg overflow-hidden">
              <MapContainer
                center={[-28.4793, 24.6727]}
                zoom={5}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                {locations.map((loc) => (
                  <Marker
                    key={loc.id}
                    position={[loc.lat, loc.lng]}
                    eventHandlers={{ click: () => setSelectedRegion(loc.name) }}
                  >
                    <Popup className="rounded-lg">
                      <div className="p-2">
                        <strong className="text-blue-800">{loc.name}</strong>
                        <br />
                        <span className="text-sm text-blue-600">{loc.beneficiaries.length} beneficiaries</span>
                        <ul className="text-xs mt-2 text-gray-700">
                          {loc.beneficiaries.slice(0, 10).map((b) => (
                            <li key={b.id}>• {b.name}</li>
                          ))}
                          {loc.beneficiaries.length > 10 && <li>...and {loc.beneficiaries.length - 10} more</li>}
                        </ul>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
            <div className="mt-3 text-sm text-blue-600">
              Tip: click a province pin to see the full beneficiary list below.
            </div>
          </div>

          <div className="bg-white bg-opacity-90 backdrop-blur-sm p-5 rounded-xl shadow-lg border border-blue-100 transition-all duration-300 hover:shadow-xl lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4 text-blue-800">Breakdown by Program</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="period" stroke="#4a5568" />
                  <YAxis stroke="#4a5568" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #25678eff',
                      borderRadius: '0.5rem'
                    }} 
                  />
                  <Legend />
                  <Bar dataKey="smes" name="SMEs" fill="#4c51bf" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="youth" name="SMEs" fill="#38a169" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="jobs" name="Jobs" fill="#dd6b20" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Beneficiaries List (shown when a pin selected) */}
        {selectedRegion && !selectedBeneficiary && (
          <section className="bg-white bg-opacity-90 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-blue-100 transition-all duration-300 mb-8">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-semibold text-blue-800">Beneficiaries in {selectedRegion}</h3>
              <button 
                className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-200 transition-colors"
                onClick={() => setSelectedRegion(null)}
              >
                Close
              </button>
            </div>

            {regionBeneficiaries.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No beneficiaries yet for this province.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {regionBeneficiaries.map((b) => (
                  <div
                    key={b.id}
                    className="border border-blue-100 rounded-xl p-4 shadow-md cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-blue-300 hover:scale-[1.02] bg-white"
                    onClick={() => setSelectedBeneficiary(b)}
                  >
                    {b.image && (
                      <img 
                        src={b.image} 
                        alt={b.name} 
                        className="w-full h-40 object-cover rounded-lg mb-3" 
                      />
                    )}
                    <h4 className="font-bold text-blue-800">{b.name}</h4>
                    <p className="text-sm text-gray-600 line-clamp-2 mt-2">{b.description}</p>
                    {(b.website || b.profile) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {b.website && (
                          <a
                            href={b.website.startsWith("http") ? b.website : `https://${b.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                          >
                            Website
                          </a>
                        )}
                        {b.profile && (
                          <a
                            href={b.profile}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 transition-colors"
                          >
                            Profile
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
          <section className="bg-white bg-opacity-90 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-blue-100 transition-all duration-300 mb-8">
            <button 
              className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-200 transition-colors mb-5"
              onClick={() => setSelectedBeneficiary(null)}
            >
              ← Back to {selectedRegion} beneficiaries
            </button>
            <div className="flex flex-col md:flex-row gap-6">
              {selectedBeneficiary.image && (
                <img 
                  src={selectedBeneficiary.image} 
                  alt={selectedBeneficiary.name} 
                  className="w-full md:w-64 h-64 object-cover rounded-xl shadow-md" 
                />
              )}
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-blue-800 mb-3">{selectedBeneficiary.name}</h3>
                <p className="text-gray-700 mb-4">{selectedBeneficiary.description}</p>
                {(selectedBeneficiary.website || selectedBeneficiary.profile) && (
                  <div className="flex flex-wrap gap-3">
                    {selectedBeneficiary.website && (
                      <a
                        href={selectedBeneficiary.website.startsWith("http") ? selectedBeneficiary.website : `https://${selectedBeneficiary.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        Visit Website
                      </a>
                    )}
                    {selectedBeneficiary.profile && (
                      <a
                        href={selectedBeneficiary.profile}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-green-100 text-green-700 px-4 py-2 rounded-lg hover:bg-green-200 transition-colors"
                      >
                        Open Company Profile
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        <footer className="text-center text-sm text-blue-600 pt-4 border-t border-blue-100 mt-8">
          Built for Brandscapers Africa • Impact Tracker Dashboard
        </footer>
      </div>
    </div>
  );
}