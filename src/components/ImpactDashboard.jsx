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

// Fix for Leaflet icons on mobile
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const METRICS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRU9N7l6y2kzhAMtCg74nXA0T8aDfGvQBkac0RipVZsWRqyqof_66n6u-EP8Tr3sQTloEgz0n2Bn59y/pub?gid=0&single=true&output=csv";
const TREND_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRU9N7l6y2kzhAMtCg74nXA0T8aDfGvQBkac0RipVZsWRqyqof_66n6u-EP8Tr3sQTloEgz0n2Bn59y/pub?gid=1901505649&single=true&output=csv";
const LOCATIONS_CSV_URL = "";
const BENEFICIARIES_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRU9N7l6y2kzhAMtCg74nXA0T8aDfGvQBkac0RipVZsWRqyqof_66n6u-EP8Tr3sQTloEgz0n2Bn59y/pub?gid=2007485460&single=true&output=csv";

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

const REGION_ALIASES = {
  "gauteng": "Gauteng", "gp": "Gauteng",
  "kwazulu-natal": "KwaZulu-Natal", "kwazulu natal": "KwaZulu-Natal", "kzn": "KwaZulu-Natal",
  "western cape": "Western Cape", "wc": "Western Cape",
  "eastern cape": "Eastern Cape", "ec": "Eastern Cape",
  "northern cape": "Northern Cape", "n cape": "Northern Cape",
  "free state": "Free State", "fs": "Free State",
  "north west": "North West", "north-west": "North West", "nw": "North West",
  "limpopo": "Limpopo",
  "mpumalanga": "Mpumalanga",
};

function normalizeKey(s) {
  if (!s && s !== 0) return "";
  return String(s).trim().toLowerCase().replace(/[_]+/g, " ").replace(/[-]+/g, " ").replace(/\s+/g, " ");
}

function canonicalRegionName(raw) {
  const key = normalizeKey(raw);
  if (!key) return "";
  if (REGION_ALIASES[key]) return REGION_ALIASES[key];
  for (const canon of Object.keys(REGION_COORDS)) {
    if (normalizeKey(canon) === key) return canon;
  }
  return raw.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function sameRegion(a, b) {
  return normalizeKey(a) === normalizeKey(b);
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white shadow-xl rounded-2xl p-4 sm:p-6 flex flex-col justify-between transition-all duration-700 hover:shadow-[0_25px_70px_rgba(59,130,246,0.5)] hover:scale-[1.03] sm:hover:scale-[1.08] border border-blue-100 hover:border-blue-300 group backdrop-blur-sm relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-blue-100/50 opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-2xl"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-blue-200/40 to-transparent translate-x-[-100%] translate-y-[-100%] group-hover:translate-x-[100%] group-hover:translate-y-[100%] transition-transform duration-1000 ease-out"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1200"></div>
      <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-blue-600 group-hover:text-blue-700 transition-colors duration-500 relative z-10 group-hover:translate-y-[-2px] truncate">{label}</div>
      <div className="text-2xl sm:text-3xl md:text-4xl font-black mt-3 sm:mt-4 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 bg-clip-text text-transparent group-hover:from-blue-700 group-hover:via-blue-600 group-hover:to-blue-500 transition-all duration-700 relative z-10 group-hover:scale-110 drop-shadow-lg">{value}</div>
      <div className="mt-3 sm:mt-4 h-1 sm:h-1.5 w-12 sm:w-16 bg-gradient-to-r from-blue-500 to-blue-300 rounded-full group-hover:w-20 sm:group-hover:w-28 group-hover:h-2 group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-white transition-all duration-700 relative z-10 group-hover:shadow-lg group-hover:shadow-blue-400/70"></div>
      <div className="absolute top-0 right-0 w-12 h-12 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-100/0 to-blue-200/0 group-hover:from-blue-100/50 group-hover:to-blue-200/30 rounded-bl-full transition-all duration-700"></div>
    </div>
  );
}

export default function ImpactDashboard() {
  const [stats, setStats] = useState({});
  const [trendData, setTrendData] = useState([]);
  const [locations, setLocations] = useState([]);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check mobile on mount and resize
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [metricsResp, trendResp, locationsResp, beneficiariesResp] = await Promise.all([
          axios.get(METRICS_CSV_URL),
          axios.get(TREND_CSV_URL),
          axios.get(LOCATIONS_CSV_URL).catch(() => ({ data: "" })),
          axios.get(BENEFICIARIES_CSV_URL),
        ]);

        const metricsRows = Papa.parse(metricsResp.data || "", { header: true, dynamicTyping: true }).data;
        const trendRows = Papa.parse(trendResp.data || "", { header: true, dynamicTyping: true }).data;
        const locationRows = Papa.parse(locationsResp.data || "", { header: true, dynamicTyping: true }).data;
        const beneficiaryRows = Papa.parse(beneficiariesResp.data || "", { header: true, dynamicTyping: true }).data;

        const buildStats = {
          smesSupported: Number(metricsRows.find((r) => (r.metric || "").toLowerCase() === "smes")?.value) || 0,
          youthTrained: Number(metricsRows.find((r) => (r.metric || "").toLowerCase() === "youth")?.value) || 0,
          jobsCreated: Number(metricsRows.find((r) => (r.metric || "").toLowerCase() === "jobs")?.value) || 0,
          businessesFunded: Number(metricsRows.find((r) => (r.metric || "").toLowerCase() === "funded")?.value) || 0,
        };

        const trendFromSheet = (trendRows || []).filter((r) => r && r.period).map((r) => ({
          period: r.period,
          smes: Number(r.smes) || 0,
          youth: Number(r.youth) || 0,
          jobs: Number(r.jobs) || 0,
        }));

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

        const regionMap = {};
        bens.forEach((b) => {
          const key = normalizeKey(b.region || "");
          if (!regionMap[key]) {
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
          }
        });

        const locsArray = Object.values(regionMap);

        if (!mounted) return;
        setStats(buildStats);
        setTrendData(trendFromSheet);
        setBeneficiaries(bens);
        setLocations(locsArray);
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

  const regionBeneficiaries = beneficiaries.filter((b) => sameRegion(b.region, selectedRegion));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100/50 p-3 sm:p-4 md:p-8 relative overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-blue-200/30 via-white/20 to-blue-300/25 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-blue-100/25 via-white/15 to-blue-200/30 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/2 left-1/3 w-72 h-72 bg-gradient-to-r from-white/20 via-blue-100/20 to-blue-200/25 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-gradient-to-bl from-blue-300/20 via-white/25 to-blue-100/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1.5s'}}></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header - Mobile Responsive */}
        <header className="mb-8 sm:mb-12 flex flex-col items-center px-2 sm:px-0">
          <div className="relative mb-4 sm:mb-6 group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-white to-blue-500 rounded-2xl blur-xl opacity-30 group-hover:opacity-70 group-hover:blur-2xl transition-all duration-700 group-hover:scale-110 animate-pulse"></div>
            <div className="absolute inset-0 bg-gradient-to-l from-blue-300 via-blue-100 to-white rounded-2xl blur-lg opacity-20 group-hover:opacity-50 transition-all duration-700 group-hover:rotate-180"></div>
            <img 
              src="/logo-B.svg" 
              alt="Logo" 
              className="h-16 sm:h-20 mb-3 sm:mb-4 relative transition-all duration-700 group-hover:scale-125 group-hover:rotate-6 group-hover:drop-shadow-2xl filter drop-shadow-lg" 
            />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-center mb-3 sm:mb-4 px-2">
            <span className="bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 bg-clip-text text-transparent hover:from-blue-700 hover:via-blue-600 hover:to-white transition-all duration-700 cursor-default drop-shadow-sm">Brandscapers Africa</span>
          </h1>
          <p className="text-sm sm:text-lg md:text-xl text-blue-600/80 text-center max-w-3xl px-3 sm:px-0">
            <span className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 bg-clip-text text-transparent font-semibold hover:from-blue-800 hover:via-blue-700 hover:to-blue-600 transition-all duration-700 cursor-default">Impact Tracker Dashboard</span>
            <span className="block text-xs sm:text-sm md:text-base text-blue-600/70 font-normal mt-1 sm:mt-2 hover:text-blue-700/80 transition-colors duration-500">
              Live insights on SME empowerment, youth development, and economic growth across South Africa
            </span>
          </p>
        </header>

        {/* Stats Cards - Mobile Responsive Grid */}
        <section className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-8 sm:mb-12">
          <StatCard label="SMEs Supported" value={loading ? "—" : stats.smesSupported?.toLocaleString()} />
          <StatCard label="Youth Trained" value={loading ? "—" : stats.youthTrained?.toLocaleString()} />
          <StatCard label="Jobs Created" value={loading ? "—" : stats.jobsCreated?.toLocaleString()} />
          <StatCard label="Businesses Funded" value={loading ? "—" : stats.businessesFunded?.toLocaleString()} />
        </section>

        {/* Charts and Map Section - Mobile Responsive Layout */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-8 sm:mb-12">
          {/* Progress Timeline Chart */}
          <div className="bg-white/95 backdrop-blur-xl p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl border border-blue-100 transition-all duration-700 hover:shadow-[0_30px_80px_rgba(59,130,246,0.4)] hover:scale-[1.01] sm:hover:scale-[1.02] group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 via-white/0 to-blue-100/0 group-hover:from-blue-50/60 group-hover:via-white/40 group-hover:to-blue-100/50 transition-all duration-700 rounded-3xl"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-100/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1200"></div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 relative z-10 gap-2">
              <h3 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 bg-clip-text text-transparent group-hover:from-blue-800 group-hover:via-blue-700 group-hover:to-blue-600 transition-all duration-700">
                Progress Timeline
              </h3>
              <span className="text-xs font-semibold bg-gradient-to-r from-blue-100 to-white text-blue-700 px-2 sm:px-3 py-1 rounded-full group-hover:bg-gradient-to-r group-hover:from-blue-200 group-hover:to-blue-50 group-hover:text-blue-800 transition-all duration-500 group-hover:shadow-lg group-hover:shadow-blue-300/50 group-hover:scale-105 w-fit">
                LIVE TRACKING
              </span>
            </div>
            <div className="h-56 sm:h-64 md:h-72 relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={isMobile ? { top: 5, right: 5, left: 0, bottom: 5 } : { top: 10, right: 10, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
                  <XAxis 
                    dataKey="period" 
                    stroke="#4a5568" 
                    fontSize={isMobile ? 10 : 12} 
                    tick={{ fill: '#4a5568' }}
                    tickMargin={isMobile ? 5 : 10}
                  />
                  <YAxis 
                    stroke="#4a5568" 
                    fontSize={isMobile ? 10 : 12} 
                    tick={{ fill: '#4a5568' }}
                    width={isMobile ? 30 : 40}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      border: 'none', 
                      borderRadius: '12px', 
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)', 
                      padding: '8px 12px',
                      fontSize: isMobile ? '12px' : '14px'
                    }} 
                    labelStyle={{ color: '#1e40af', fontWeight: 'bold' }} 
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36}
                    wrapperStyle={{ fontSize: isMobile ? '11px' : '12px', paddingBottom: '10px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="smes" 
                    name="SMEs Supported" 
                    stroke="#2563eb" 
                    strokeWidth={isMobile ? 2 : 3} 
                    dot={{ r: isMobile ? 3 : 5, fill: '#2563eb' }} 
                    activeDot={{ r: isMobile ? 6 : 8, fill: '#1d4ed8' }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="youth" 
                    name="Youth Trained" 
                    stroke="#3b82f6" 
                    strokeWidth={isMobile ? 2 : 3} 
                    dot={{ r: isMobile ? 3 : 5, fill: '#3b82f6' }} 
                    activeDot={{ r: isMobile ? 6 : 8, fill: '#2563eb' }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="jobs" 
                    name="Jobs Created" 
                    stroke="#60a5fa" 
                    strokeWidth={isMobile ? 2 : 3} 
                    dot={{ r: isMobile ? 3 : 5, fill: '#60a5fa' }} 
                    activeDot={{ r: isMobile ? 6 : 8, fill: '#3b82f6' }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Geographic Impact Map */}
          <div className="bg-white/95 backdrop-blur-xl p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl border border-blue-100 transition-all duration-700 hover:shadow-[0_30px_80px_rgba(59,130,246,0.4)] hover:scale-[1.01] sm:hover:scale-[1.02] group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-bl from-blue-50/0 via-white/0 to-blue-100/0 group-hover:from-blue-50/50 group-hover:via-white/30 group-hover:to-blue-100/60 transition-all duration-700 rounded-3xl"></div>
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1200"></div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 relative z-10 gap-2">
              <h3 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 bg-clip-text text-transparent group-hover:from-blue-800 group-hover:via-blue-700 group-hover:to-blue-600 transition-all duration-700">
                Geographic Impact
              </h3>
              <span className="text-xs font-semibold bg-gradient-to-r from-blue-100 to-white text-blue-700 px-2 sm:px-3 py-1 rounded-full group-hover:bg-gradient-to-r group-hover:from-blue-200 group-hover:to-blue-50 group-hover:text-blue-800 transition-all duration-500 group-hover:shadow-lg group-hover:shadow-blue-300/50 group-hover:scale-105 w-fit">
                {locations.length} PROVINCES
              </span>
            </div>
            <div className="h-56 sm:h-64 md:h-72 rounded-xl sm:rounded-2xl overflow-hidden shadow-inner transition-all duration-700 group-hover:shadow-2xl group-hover:ring-2 group-hover:ring-blue-400/50 relative z-10">
              <MapContainer 
                center={[-28.4793, 24.6727]} 
                zoom={isMobile ? 4 : 5} 
                style={{ height: "100%", width: "100%" }} 
                className="rounded-xl sm:rounded-2xl"
                zoomControl={!isMobile}
                dragging={!isMobile}
                touchZoom={!isMobile}
                scrollWheelZoom={false}
                doubleClickZoom={!isMobile}
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
                      mouseover: (e) => !isMobile && e.target.openPopup(),
                      mouseout: (e) => !isMobile && e.target.closePopup()
                    }}
                  >
                    <Popup className="rounded-xl shadow-xl border border-blue-100" closeButton={!isMobile}>
                      <div className="p-2 sm:p-3 min-w-[180px] sm:min-w-[200px]">
                        <div className="flex items-center gap-2 mb-1 sm:mb-2">
                          <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 rounded-full"></div>
                          <strong className="text-blue-800 text-sm sm:text-lg">{loc.name}</strong>
                        </div>
                        <div className="text-xs sm:text-sm text-blue-600 bg-blue-50 px-2 sm:px-3 py-1 rounded-full inline-block mb-2 sm:mb-3">
                          {loc.beneficiaries.length} beneficiaries
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          {loc.beneficiaries.slice(0, 3).map((b) => (
                            <div key={b.id} className="flex items-center gap-1 sm:gap-2">
                              <span className="text-blue-500">•</span>
                              <span className="truncate text-xs sm:text-sm">{b.name}</span>
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
            <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-blue-600/70 flex items-center gap-1 sm:gap-2 relative z-10 group-hover:text-blue-700/80 transition-colors duration-500 px-1">
              <svg className="w-3 h-3 sm:w-4 sm:h-4 group-hover:scale-110 transition-transform duration-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              {isMobile ? "Tap on any province" : "Click on any province"} to explore beneficiaries
            </div>
          </div>

          {/* Program Performance Chart - Full Width */}
          <div className="bg-white/95 backdrop-blur-xl p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl border border-blue-100 transition-all duration-700 hover:shadow-[0_30px_80px_rgba(59,130,246,0.4)] hover:scale-[1.01] lg:col-span-2 group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tl from-blue-50/0 via-white/0 to-blue-100/0 group-hover:from-blue-50/50 group-hover:via-white/30 group-hover:to-blue-100/60 transition-all duration-700 rounded-3xl"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-100/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1200"></div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 relative z-10 gap-2">
              <h3 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 bg-clip-text text-transparent group-hover:from-blue-800 group-hover:via-blue-700 group-hover:to-blue-600 transition-all duration-700">
                Program Performance Breakdown
              </h3>
              <span className="text-xs font-semibold bg-gradient-to-r from-blue-100 to-white text-blue-700 px-2 sm:px-3 py-1 rounded-full group-hover:bg-gradient-to-r group-hover:from-blue-200 group-hover:to-blue-50 group-hover:text-blue-800 transition-all duration-500 group-hover:shadow-lg group-hover:shadow-blue-300/50 group-hover:scale-105 w-fit">
                QUARTERLY ANALYSIS
              </span>
            </div>
            <div className="h-52 sm:h-56 md:h-64 relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={trendData} 
                  margin={isMobile ? { top: 20, right: 10, left: 0, bottom: 10 } : { top: 20, right: 20, left: 0, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
                  <XAxis 
                    dataKey="period" 
                    stroke="#4a5568" 
                    fontSize={isMobile ? 10 : 12} 
                    tick={{ fill: '#4a5568' }}
                    tickMargin={isMobile ? 5 : 10}
                  />
                  <YAxis 
                    stroke="#4a5568" 
                    fontSize={isMobile ? 10 : 12} 
                    tick={{ fill: '#4a5568' }}
                    width={isMobile ? 30 : 40}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      border: 'none', 
                      borderRadius: '12px', 
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)', 
                      padding: '8px 12px',
                      fontSize: isMobile ? '12px' : '14px'
                    }} 
                    labelStyle={{ color: '#1e40af', fontWeight: 'bold' }} 
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36}
                    wrapperStyle={{ fontSize: isMobile ? '11px' : '12px', paddingBottom: '10px' }}
                  />
                  <Bar dataKey="smes" name="SMEs Supported" radius={[4, 4, 0, 0]}>
                    {trendData.map((entry, index) => (<Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#2563eb' : '#60a5fa'} />))}
                  </Bar>
                  <Bar dataKey="youth" name="Youth Trained" radius={[4, 4, 0, 0]}>
                    {trendData.map((entry, index) => (<Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#3b82f6' : '#93c5fd'} />))}
                  </Bar>
                  <Bar dataKey="jobs" name="Jobs Created" radius={[4, 4, 0, 0]}>
                    {trendData.map((entry, index) => (<Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#1d4ed8' : '#60a5fa'} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Beneficiaries List - Mobile Responsive */}
        {selectedRegion && !selectedBeneficiary && (
          <section className="bg-white/95 backdrop-blur-xl p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-xl border border-blue-100 transition-all duration-700 mb-8 sm:mb-10 group relative overflow-hidden hover:shadow-[0_30px_80px_rgba(59,130,246,0.4)] hover:scale-[1.005]">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 via-white/0 to-blue-100/0 group-hover:from-blue-50/60 group-hover:via-white/40 group-hover:to-blue-100/50 transition-all duration-700 rounded-3xl"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1200"></div>
            
            <div className="relative z-10">
              <div className="flex flex-col gap-4 mb-6 sm:mb-8">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 bg-clip-text text-transparent group-hover:from-blue-800 group-hover:via-blue-700 group-hover:to-blue-600 transition-all duration-700">
                    Beneficiaries in {selectedRegion}
                  </h3>
                  <p className="text-blue-600/70 text-xs sm:text-sm mt-1 sm:mt-2 group-hover:text-blue-700/80 transition-colors duration-500">
                    {regionBeneficiaries.length} {regionBeneficiaries.length === 1 ? 'business' : 'businesses'} impacting the community
                  </p>
                </div>
                <div className="flex gap-2 sm:gap-3">
                  <button 
                    className="px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-400 text-white rounded-lg sm:rounded-xl hover:from-blue-600 hover:to-blue-500 hover:shadow-[0_10px_40px_rgba(59,130,246,0.4)] transition-all duration-500 hover:scale-105 active:scale-95 font-medium group-hover:shadow-lg group-hover:drop-shadow-lg text-sm sm:text-base"
                    onClick={() => setSelectedRegion(null)}
                  >
                    <span className="flex items-center gap-1 sm:gap-2">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 group-hover:rotate-90 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Close View
                    </span>
                  </button>
                </div>
              </div>

              {regionBeneficiaries.length === 0 ? (
                <div className="text-center py-8 sm:py-12 relative z-10">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400 group-hover:text-blue-500 transition-colors duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm sm:text-lg group-hover:text-gray-600 transition-colors duration-500">
                    No beneficiaries registered for this province yet
                  </p>
                  <p className="text-gray-400 text-xs sm:text-sm mt-1 sm:mt-2 group-hover:text-gray-500 transition-colors duration-500">
                    Check back soon for updates
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 relative z-10">
                  {regionBeneficiaries.map((b) => (
                    <div
                      key={b.id}
                      className="bg-gradient-to-br from-white/90 via-blue-50/30 to-blue-100/30 border border-blue-100/50 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-lg cursor-pointer transition-all duration-500 hover:shadow-[0_20px_50px_rgba(59,130,246,0.3)] hover:scale-[1.03] hover:border-blue-300/70 hover:bg-gradient-to-bl hover:from-blue-100/50 hover:via-white/50 hover:to-blue-200/50 group/beneficiary relative overflow-hidden"
                      onClick={() => setSelectedBeneficiary(b)}
                    >
                      {/* Shimmer effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/beneficiary:translate-x-full transition-transform duration-1000"></div>
                      
                      <div className="relative overflow-hidden rounded-lg sm:rounded-xl mb-3 sm:mb-4">
                        {b.image ? (
                          <img 
                            src={b.image} 
                            alt={b.name} 
                            className="w-full h-40 sm:h-48 object-cover transition-transform duration-700 group-hover/beneficiary:scale-110" 
                          />
                        ) : (
                          <div className="w-full h-40 sm:h-48 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center group-hover/beneficiary:bg-gradient-to-bl group-hover/beneficiary:from-blue-200 group-hover/beneficiary:to-blue-100 transition-all duration-500">
                            <svg className="w-12 h-12 sm:w-16 sm:h-16 text-blue-300 group-hover/beneficiary:text-blue-400 transition-colors duration-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover/beneficiary:opacity-100 transition-opacity duration-500"></div>
                      </div>
                      <h4 className="font-bold text-base sm:text-lg text-blue-900 group-hover/beneficiary:text-blue-800 transition-colors duration-500 relative z-10 line-clamp-1">
                        {b.name}
                      </h4>
                      <p className="text-xs sm:text-sm text-gray-600 line-clamp-2 mt-1 sm:mt-2 group-hover/beneficiary:text-gray-800 transition-colors duration-500 relative z-10">
                        {b.description || "Making an impact in the community"}
                      </p>
                      {(b.website || b.profile) && (
                        <div className="mt-3 sm:mt-4 flex flex-wrap gap-1 sm:gap-2 relative z-10">
                          {b.website && (
                            <a
                              href={b.website.startsWith("http") ? b.website : `https://${b.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg hover:from-blue-200 hover:to-blue-100 hover:shadow-md hover:shadow-blue-300/50 transition-all duration-300 hover:scale-105 border border-blue-200 hover:border-blue-300 font-medium group/link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="flex items-center gap-1 group-hover/link:gap-2 transition-all duration-300">
                                <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 group-hover/link:rotate-12 transition-transform duration-300" fill="currentColor" viewBox="0 0 20 20">
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
                              className="text-xs bg-gradient-to-r from-emerald-100 to-teal-50 text-emerald-700 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg hover:from-emerald-200 hover:to-teal-100 hover:shadow-md hover:shadow-emerald-300/50 transition-all duration-300 hover:scale-105 border border-emerald-200 hover:border-emerald-300 font-medium group/link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="flex items-center gap-1 group-hover/link:gap-2 transition-all duration-300">
                                <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 group-hover/link:scale-110 transition-transform duration-300" fill="currentColor" viewBox="0 0 20 20">
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
            </div>
          </section>
        )}

        {/* Beneficiary Profile - Mobile Responsive */}
        {selectedBeneficiary && (
          <section className="bg-white/95 backdrop-blur-xl p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-xl border border-blue-100 transition-all duration-700 mb-8 sm:mb-10 group relative overflow-hidden hover:shadow-[0_30px_80px_rgba(59,130,246,0.4)] hover:scale-[1.005]">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-50/0 via-white/0 to-blue-100/0 group-hover:from-blue-50/60 group-hover:via-white/40 group-hover:to-blue-100/50 transition-all duration-700 rounded-3xl"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1200"></div>
            
            <button 
              className="text-xs sm:text-sm bg-gradient-to-r from-blue-100 to-white text-blue-700 px-2 sm:px-3 py-1 rounded-lg hover:from-blue-200 hover:to-blue-50 transition-all duration-300 hover:shadow-md border border-blue-200 hover:border-blue-300 mb-4 sm:mb-5 relative z-10"
              onClick={() => setSelectedBeneficiary(null)}
            >
              <span className="flex items-center gap-1 sm:gap-2">
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to {selectedRegion} beneficiaries
              </span>
            </button>
            
            <div className="flex flex-col md:flex-row gap-4 sm:gap-6 relative z-10">
              <div className="md:w-1/3">
                {selectedBeneficiary.image && (
                  <img 
                    src={selectedBeneficiary.image} 
                    alt={selectedBeneficiary.name} 
                    className="w-full h-48 sm:h-64 md:h-80 object-cover rounded-xl shadow-lg mb-3 transition-transform duration-500 group-hover:scale-105" 
                  />
                )}
              </div>
              <div className="md:w-2/3">
                <h3 className="text-xl sm:text-2xl font-bold text-blue-800 mb-2 sm:mb-3 group-hover:text-blue-900 transition-colors duration-500">
                  {selectedBeneficiary.name}
                </h3>
                <div className="mb-3 sm:mb-4">
                  <span className="inline-block bg-gradient-to-r from-blue-500 to-blue-400 text-white text-xs sm:text-sm font-semibold px-2 sm:px-3 py-1 rounded-full mb-2 sm:mb-3 group-hover:from-blue-600 group-hover:to-blue-500 transition-all duration-500">
                    {selectedBeneficiary.region}
                  </span>
                </div>
                <p className="text-gray-700 text-sm sm:text-base mb-4 sm:mb-6 group-hover:text-gray-800 transition-colors duration-500">
                  {selectedBeneficiary.description}
                </p>
                {(selectedBeneficiary.website || selectedBeneficiary.profile) && (
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    {selectedBeneficiary.website && (
                      <a
                        href={selectedBeneficiary.website.startsWith("http") ? selectedBeneficiary.website : `https://${selectedBeneficiary.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-gradient-to-r from-blue-500 to-blue-400 text-white text-sm sm:text-base px-3 sm:px-4 py-2 rounded-lg hover:from-blue-600 hover:to-blue-500 hover:shadow-[0_10px_30px_rgba(59,130,246,0.4)] transition-all duration-300 hover:scale-105 font-medium"
                      >
                        <span className="flex items-center gap-1 sm:gap-2">
                          <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                          </svg>
                          Visit Website
                        </span>
                      </a>
                    )}
                    {selectedBeneficiary.profile && (
                      <a
                        href={selectedBeneficiary.profile}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 text-white text-sm sm:text-base px-3 sm:px-4 py-2 rounded-lg hover:from-emerald-600 hover:to-teal-500 hover:shadow-[0_10px_30px_rgba(16,185,129,0.4)] transition-all duration-300 hover:scale-105 font-medium"
                      >
                        <span className="flex items-center gap-1 sm:gap-2">
                          <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm4 14a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                          Open Company Profile
                        </span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Footer - Mobile Responsive */}
        <footer className="text-center text-xs sm:text-sm text-blue-600 pt-3 sm:pt-4 border-t border-blue-100 mt-6 sm:mt-8 transition-colors duration-300 hover:text-blue-700 relative z-10 px-2 sm:px-0">
          <div className="flex items-center justify-center gap-1 sm:gap-2 mb-1 sm:mb-2">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 animate-pulse"></div>
            <div>Built by Brandscapers Africa</div>
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-400 animate-pulse" style={{animationDelay: '0.5s'}}></div>
          </div>
          <p>Impact Tracker Dashboard • {new Date().getFullYear()}</p>
        </footer>
      </div>
    </div>
  );
}