"use client";

import { useEffect, useRef, useState } from "react";
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

  // ------------------------------------
  // LOAD REPORTS
  // ------------------------------------

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
                typeof report.latitude ===
                  "number" &&
                typeof report.longitude ===
                  "number"
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

  // ------------------------------------
  // CREATE MAP
  // ------------------------------------

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

  // ------------------------------------
  // REPORT MARKERS
  // ------------------------------------

  useEffect(() => {
    const map =
      mapRef.current;

    if (!map) {
      return;
    }

    const markers:
      maplibregl.Marker[] = [];

    reports.forEach(
      (report) => {

        // Custom marker wrapper
        const markerElement =
          document.createElement(
            "div"
          );

        markerElement.style.width =
          "46px";

        markerElement.style.height =
          "46px";

        markerElement.style.borderRadius =
          "50%";

        markerElement.style.display =
          "flex";

        markerElement.style.alignItems =
          "center";

        markerElement.style.justifyContent =
          "center";

        markerElement.style.fontSize =
          "23px";

        markerElement.style.cursor =
          "pointer";

        markerElement.style.background =
          getSeverityColor(
            report.severity
          );

        markerElement.style.border =
          "3px solid white";

        markerElement.style.boxShadow =
          "0 4px 12px rgba(0,0,0,0.35)";

        markerElement.style.transition =
          "transform 0.15s ease";

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

        markerElement.textContent =
          getCategoryIcon(
            report.category
          );

        // Popup
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

        button.style.borderRadius =
          "7px";

        button.style.border =
          "none";

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

    return () => {
      markers.forEach(
        (marker) =>
          marker.remove()
      );
    };
  }, [reports, router]);

  // ------------------------------------
  // USER LOCATION
  // ------------------------------------

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

        // Remove previous user marker
        userMarkerRef.current?.remove();

        const userMarker =
          document.createElement(
            "div"
          );

        userMarker.style.width =
          "22px";

        userMarker.style.height =
          "22px";

        userMarker.style.borderRadius =
          "50%";

        userMarker.style.background =
          "#3b82f6";

        userMarker.style.border =
          "4px solid white";

        userMarker.style.boxShadow =
          "0 0 0 5px rgba(59,130,246,0.25)";

        userMarker.title =
          "Your location";

        userMarkerRef.current =
          new maplibregl.Marker({
            element: userMarker,
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

        // Smoothly move map to user
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
            "Location permission was denied. Please allow location access in your browser."
          );
        } else {
          setError(
            "We could not determine your location."
          );
        }

        setLocationLoading(
          false
        );
      },

      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    );
  }

  // ------------------------------------
  // UI
  // ------------------------------------

  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* HEADER */}

      <div className="border-b border-gray-800 bg-gray-900 p-5">

        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

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
        className="h-[calc(100vh-145px)] w-full"
      />

    </main>
  );
}