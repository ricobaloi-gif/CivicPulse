"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import * as maplibregl from "maplibre-gl";
import type { Map } from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

import {
  collection,
  getDocs,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";

type Report = {
  id: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  latitude: number;
  longitude: number;
  confirmationCount?: number;
};

function getCategoryIcon(category: string) {
  switch (category) {
    case "Pothole":
      return "🕳️";

    case "Water Leak":
      return "💧";

    case "Power Outage":
      return "⚡";

    case "Broken Streetlight":
      return "💡";

    case "Illegal Dumping":
      return "⚠️";

    case "Road Hazard":
      return "🚧";

    case "Sewer Issue":
      return "☣️";

    case "Vandalism":
      return "🧱";

    default:
      return "📍";
  }
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case "critical":
      return "#dc2626";

    case "high":
      return "#ea580c";

    case "medium":
      return "#ca8a04";

    case "low":
      return "#16a34a";

    default:
      return "#2563eb";
  }
}

export default function MapPage() {
  const router = useRouter();

  const mapContainer =
    useRef<HTMLDivElement | null>(null);

  const mapRef =
    useRef<Map | null>(null);

  const userMarkerRef =
    useRef<maplibregl.Marker | null>(null);

  const [reports, setReports] =
    useState<Report[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [locationLoading, setLocationLoading] =
    useState(false);

  const [locationFound, setLocationFound] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [categoryFilter, setCategoryFilter] =
    useState("all");

  const [severityFilter, setSeverityFilter] =
    useState("all");

  const [statusFilter, setStatusFilter] =
    useState("all");

  // ----------------------------------
  // LOAD REPORTS
  // ----------------------------------

  useEffect(() => {
    async function loadReports() {
      try {
        setLoading(true);
        setError("");

        const snapshot =
          await getDocs(
            collection(db, "reports")
          );

        const loadedReports: Report[] =
          snapshot.docs
            .map((document) => ({
              id: document.id,

              ...(document.data() as Omit<
                Report,
                "id"
              >),
            }))
            .filter(
              (report) =>
                typeof report.latitude === "number" &&
                typeof report.longitude === "number"
            );

        setReports(loadedReports);
      } catch (err) {
        console.error(
          "Map report error:",
          err
        );

        setError(
          "Failed to load community reports."
        );
      } finally {
        setLoading(false);
      }
    }

    loadReports();
  }, []);

  // ----------------------------------
  // FILTER REPORTS
  // ----------------------------------

  const filteredReports =
    useMemo(() => {
      return reports.filter((report) => {
        const matchesSearch =
          report.title
            .toLowerCase()
            .includes(
              search.toLowerCase()
            );

        const matchesCategory =
          categoryFilter === "all" ||
          report.category === categoryFilter;

        const matchesSeverity =
          severityFilter === "all" ||
          report.severity === severityFilter;

        const matchesStatus =
          statusFilter === "all" ||
          report.status === statusFilter;

        return (
          matchesSearch &&
          matchesCategory &&
          matchesSeverity &&
          matchesStatus
        );
      });
    }, [
      reports,
      search,
      categoryFilter,
      severityFilter,
      statusFilter,
    ]);

  // ----------------------------------
  // CREATE MAP
  // ----------------------------------

  useEffect(() => {
    if (!mapContainer.current) {
      return;
    }

    if (mapRef.current) {
      return;
    }

    const map =
      new maplibregl.Map({
        container:
          mapContainer.current,

        style: {
          version: 8,

          sources: {
            osm: {
              type: "raster",

              tiles: [
                "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
              ],

              tileSize: 256,

              maxzoom: 19,

              attribution:
                "© OpenStreetMap contributors",
            },
          },

          layers: [
            {
              id: "osm",
              type: "raster",
              source: "osm",
            },
          ],
        },

        center: [
          28.0473,
          -26.2041,
        ],

        zoom: 11,

        maxZoom: 19,
      });

    map.addControl(
      new maplibregl.NavigationControl(),
      "top-right"
    );

    mapRef.current = map;

    return () => {
      userMarkerRef.current?.remove();

      map.remove();

      mapRef.current = null;
    };
  }, []);

  // ----------------------------------
  // REPORT MARKERS
  // ----------------------------------

  useEffect(() => {
    const map =
      mapRef.current;

    if (!map) {
      return;
    }

    const markers:
      maplibregl.Marker[] = [];

    filteredReports.forEach(
      (report) => {
        const markerElement =
          document.createElement(
            "div"
          );

        markerElement.style.width =
          "48px";

        markerElement.style.height =
          "48px";

        markerElement.style.borderRadius =
          "50%";

        markerElement.style.display =
          "flex";

        markerElement.style.alignItems =
          "center";

        markerElement.style.justifyContent =
          "center";

        markerElement.style.fontSize =
          "24px";

        markerElement.style.cursor =
          "pointer";

        markerElement.style.background =
          getSeverityColor(
            report.severity
          );

        markerElement.style.border =
          "3px solid white";

        markerElement.style.boxShadow =
          "0 4px 14px rgba(0,0,0,0.45)";

        markerElement.style.transition =
          "transform 0.15s ease";

        markerElement.textContent =
          getCategoryIcon(
            report.category
          );

        markerElement.title =
          `${report.category}: ${report.title}`;

        markerElement.addEventListener(
          "mouseenter",
          () => {
            markerElement.style.transform =
              "scale(1.15)";
          }
        );

        markerElement.addEventListener(
          "mouseleave",
          () => {
            markerElement.style.transform =
              "scale(1)";
          }
        );

        // ----------------------------
        // POPUP
        // ----------------------------

        const popupContainer =
          document.createElement(
            "div"
          );

        popupContainer.style.minWidth =
          "220px";

        popupContainer.style.color =
          "#111827";

        const title =
          document.createElement(
            "strong"
          );

        title.textContent =
          report.title;

        title.style.fontSize =
          "16px";

        popupContainer.appendChild(
          title
        );

        const category =
          document.createElement(
            "div"
          );

        category.textContent =
          `${getCategoryIcon(
            report.category
          )} ${report.category}`;

        category.style.marginTop =
          "8px";

        popupContainer.appendChild(
          category
        );

        const severity =
          document.createElement(
            "div"
          );

        severity.textContent =
          `Severity: ${report.severity}`;

        severity.style.marginTop =
          "5px";

        popupContainer.appendChild(
          severity
        );

        const status =
          document.createElement(
            "div"
          );

        status.textContent =
          `Status: ${report.status}`;

        status.style.marginTop =
          "5px";

        popupContainer.appendChild(
          status
        );

        const confirmations =
          document.createElement(
            "div"
          );

        confirmations.textContent =
          `${
            report.confirmationCount ??
            0
          } confirmations`;

        confirmations.style.marginTop =
          "5px";

        popupContainer.appendChild(
          confirmations
        );

        const button =
          document.createElement(
            "button"
          );

        button.textContent =
          "View Report";

        button.style.marginTop =
          "12px";

        button.style.padding =
          "8px 12px";

        button.style.background =
          "#2563eb";

        button.style.color =
          "white";

        button.style.border =
          "none";

        button.style.borderRadius =
          "7px";

        button.style.cursor =
          "pointer";

        button.style.fontWeight =
          "600";

        button.addEventListener(
          "click",
          () => {
            router.push(
              `/report/${report.id}`
            );
          }
        );

        popupContainer.appendChild(
          button
        );

        const popup =
          new maplibregl.Popup({
            offset: 30,
          }).setDOMContent(
            popupContainer
          );

        const marker =
          new maplibregl.Marker({
            element:
              markerElement,
          })
            .setLngLat([
              report.longitude,
              report.latitude,
            ])
            .setPopup(popup)
            .addTo(map);

        markers.push(marker);
      }
    );

    // AUTO CENTER REPORTS

    if (
      filteredReports.length === 1
    ) {
      const report =
        filteredReports[0];

      map.flyTo({
        center: [
          report.longitude,
          report.latitude,
        ],

        zoom: 15,

        essential: true,
      });
    }

    if (
      filteredReports.length > 1
    ) {
      const bounds =
        new maplibregl.LngLatBounds();

      filteredReports.forEach(
        (report) => {
          bounds.extend([
            report.longitude,
            report.latitude,
          ]);
        }
      );

      map.fitBounds(
        bounds,
        {
          padding: 80,
          maxZoom: 15,
          duration: 1000,
        }
      );
    }

    return () => {
      markers.forEach(
        (marker) =>
          marker.remove()
      );
    };
  }, [
    filteredReports,
    router,
  ]);

  // ----------------------------------
  // FIND USER LOCATION
  // ----------------------------------

  function findMyLocation() {
    const map =
      mapRef.current;

    if (!map) {
      return;
    }

    if (
      !navigator.geolocation
    ) {
      setError(
        "Your browser does not support location services."
      );

      return;
    }

    setLocationLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const longitude =
          position.coords.longitude;

        const latitude =
          position.coords.latitude;

        userMarkerRef.current?.remove();

        const markerElement =
          document.createElement(
            "div"
          );

        markerElement.style.width =
          "22px";

        markerElement.style.height =
          "22px";

        markerElement.style.borderRadius =
          "50%";

        markerElement.style.background =
          "#3b82f6";

        markerElement.style.border =
          "4px solid white";

        markerElement.style.boxShadow =
          "0 0 0 5px rgba(59,130,246,0.25)";

        markerElement.title =
          "Your location";

        userMarkerRef.current =
          new maplibregl.Marker({
            element:
              markerElement,
          })
            .setLngLat([
              longitude,
              latitude,
            ])
            .setPopup(
              new maplibregl.Popup({
                offset: 20,
              }).setText(
                "You are here"
              )
            )
            .addTo(map);

        map.flyTo({
          center: [
            longitude,
            latitude,
          ],

          zoom: 15,

          essential: true,
        });

        setLocationFound(true);
        setLocationLoading(false);
      },

      (locationError) => {
        console.error(
          "Location error:",
          locationError
        );

        if (
          locationError.code ===
          locationError.PERMISSION_DENIED
        ) {
          setError(
            "Location permission was denied. Please allow location access."
          );
        } else {
          setError(
            "We could not determine your location."
          );
        }

        setLocationLoading(false);
      },

      {
        enableHighAccuracy:
          true,

        timeout:
          15000,

        maximumAge:
          30000,
      }
    );
  }

  // ----------------------------------
  // CLEAR FILTERS
  // ----------------------------------

  function clearFilters() {
    setSearch("");
    setCategoryFilter("all");
    setSeverityFilter("all");
    setStatusFilter("all");
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* HEADER */}

      <div className="border-b border-gray-800 bg-gray-900 p-5">

        <div className="mx-auto max-w-7xl">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <h1 className="text-2xl font-bold">
                CivicPulse Map
              </h1>

              <p className="text-sm text-gray-400">
                Explore issues reported across your community.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">

              <button
                onClick={
                  findMyLocation
                }
                disabled={
                  locationLoading
                }
                className="rounded-lg bg-green-600 px-4 py-2 font-semibold hover:bg-green-500 disabled:opacity-50"
              >
                {locationLoading
                  ? "Finding you..."
                  : locationFound
                  ? "📍 My Location"
                  : "◎ Find My Location"}
              </button>

              <button
                onClick={() =>
                  router.push(
                    "/dashboard"
                  )
                }
                className="rounded-lg border border-gray-700 px-4 py-2 hover:bg-gray-800"
              >
                Dashboard
              </button>

              <button
                onClick={() =>
                  router.push(
                    "/report/new"
                  )
                }
                className="rounded-lg bg-blue-600 px-4 py-2 font-semibold hover:bg-blue-500"
              >
                Report Issue
              </button>

            </div>
          </div>

          {/* FILTERS */}

          <div className="mt-5 grid gap-3 md:grid-cols-5">

            <input
              type="text"
              placeholder="Search reports..."
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 outline-none"
            />

            <select
              value={
                categoryFilter
              }
              onChange={(e) =>
                setCategoryFilter(
                  e.target.value
                )
              }
              className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2"
            >
              <option value="all">
                All categories
              </option>

              <option value="Pothole">
                Pothole
              </option>

              <option value="Water Leak">
                Water Leak
              </option>

              <option value="Power Outage">
                Power Outage
              </option>

              <option value="Broken Streetlight">
                Broken Streetlight
              </option>

              <option value="Illegal Dumping">
                Illegal Dumping
              </option>

              <option value="Road Hazard">
                Road Hazard
              </option>

              <option value="Sewer Issue">
                Sewer Issue
              </option>

              <option value="Vandalism">
                Vandalism
              </option>

              <option value="Other">
                Other
              </option>
            </select>

            <select
              value={
                severityFilter
              }
              onChange={(e) =>
                setSeverityFilter(
                  e.target.value
                )
              }
              className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2"
            >
              <option value="all">
                All severities
              </option>

              <option value="low">
                Low
              </option>

              <option value="medium">
                Medium
              </option>

              <option value="high">
                High
              </option>

              <option value="critical">
                Critical
              </option>
            </select>

            <select
              value={
                statusFilter
              }
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
              className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2"
            >
              <option value="all">
                All statuses
              </option>

              <option value="submitted">
                Submitted
              </option>

              <option value="verified">
                Verified
              </option>

              <option value="acknowledged">
                Acknowledged
              </option>

              <option value="assigned">
                Assigned
              </option>

              <option value="in-progress">
                In Progress
              </option>

              <option value="resolved">
                Resolved
              </option>
            </select>

            <button
              onClick={
                clearFilters
              }
              className="rounded-lg border border-gray-700 px-4 py-2 hover:bg-gray-800"
            >
              Clear Filters
            </button>

          </div>

          <p className="mt-3 text-sm text-gray-400">
            Showing{" "}

            <span className="font-semibold text-white">
              {
                filteredReports.length
              }
            </span>

            {" "}of{" "}

            <span className="font-semibold text-white">
              {
                reports.length
              }
            </span>

            {" "}reports
          </p>

        </div>
      </div>

      {/* LEGEND */}

      <div className="border-b border-gray-800 bg-gray-900/95 px-5 py-3">

        <div className="mx-auto flex max-w-7xl flex-wrap gap-x-5 gap-y-2 text-sm text-gray-300">

          <span>
            🕳️ Pothole
          </span>

          <span>
            💧 Water
          </span>

          <span>
            ⚡ Electricity
          </span>

          <span>
            💡 Streetlight
          </span>

          <span>
            ⚠️ Dumping
          </span>

          <span>
            🚧 Road Hazard
          </span>

          <span>
            ☣️ Sewer
          </span>

          <span>
            🧱 Vandalism
          </span>

        </div>
      </div>

      {/* ERROR */}

      {error && (
        <div className="border-b border-red-900 bg-red-950 p-4 text-center text-sm text-red-300">
          {error}
        </div>
      )}

      {/* LOADING */}

      {loading && (
        <div className="bg-gray-900 p-3 text-center text-sm text-gray-400">
          Loading community reports...
        </div>
      )}

      {/* MAP */}

      <div
        ref={mapContainer}
        className="h-[calc(100vh-250px)] w-full"
      />

    </main>
  );
}