"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import * as maplibregl from "maplibre-gl";
import type { Map } from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

import {
  db,
} from "@/src/lib/firebase";

import {
  useAuth,
} from "@/src/lib/AuthContext";

import { MapPin, Search, Filter, X, Layers, Navigation, Locate, Plus, LayoutDashboard } from "lucide-react";

type UserProfile = {
  uid?: string;
  name?: string;
  email?: string;
  role?: string;

  organizationId?: string | null;
  organizationName?: string | null;
};

type Report = {
  id: string;

  title: string;
  description?: string;

  category: string;
  severity: string;
  status: string;

  latitude: number;
  longitude: number;

  confirmationCount?: number;

  organizationId?: string | null;
  organizationName?: string | null;
};

function getCategoryEmoji(
  category: string
) {
  switch (
    category
      .toLowerCase()
      .trim()
  ) {
    case "pothole":
      return "🕳️";

    case "water leak":
      return "💧";

    case "power outage":
      return "⚡";

    case "broken streetlight":
      return "💡";

    case "illegal dumping":
      return "⚠️";

    case "road hazard":
      return "🚧";

    case "sewer issue":
      return "☣️";

    case "vandalism":
      return "🧱";

    default:
      return "📍";
  }
}

function getSeverityColor(
  severity: string
) {
  switch (
    severity
      .toLowerCase()
      .trim()
  ) {
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

function getStatusLabel(
  status: string
) {
  switch (status) {
    case "submitted":
      return "Submitted";

    case "acknowledged":
      return "Acknowledged";

    case "assigned":
      return "Assigned";

    case "in-progress":
      return "In Progress";

    case "resolved":
      return "Resolved";

    case "reopened":
      return "Reopened";

    case "verified":
      return "Verified";

    case "rejected":
      return "Rejected";

    case "duplicate":
      return "Duplicate";

    default:
      return status;
  }
}

export default function MapPage() {
  const router =
    useRouter();

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const mapContainerRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const mapRef =
    useRef<Map | null>(
      null
    );

  const markersRef =
    useRef<
      maplibregl.Marker[]
    >([]);

  const userMarkerRef =
    useRef<maplibregl.Marker | null>(
      null
    );

  const [
    profile,
    setProfile,
  ] =
    useState<UserProfile | null>(
      null
    );

  const [
    reports,
    setReports,
  ] =
    useState<Report[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    mapReady,
    setMapReady,
  ] =
    useState(false);

  const [
    locating,
    setLocating,
  ] =
    useState(false);

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    categoryFilter,
    setCategoryFilter,
  ] =
    useState("all");

  const [
    severityFilter,
    setSeverityFilter,
  ] =
    useState("all");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState("all");

  const [
    error,
    setError,
  ] =
    useState("");

  async function loadData() {
    if (!user) {
      return;
    }

    const currentUser =
      user;

    try {
      setLoading(true);
      setError("");

      const userRef =
        doc(
          db,
          "users",
          currentUser.uid
        );

      const userSnapshot =
        await getDoc(
          userRef
        );

      if (
        !userSnapshot.exists()
      ) {
        setError(
          "Your CivicPulse profile could not be found."
        );

        return;
      }

      const currentProfile =
        userSnapshot.data() as UserProfile;

      setProfile(
        currentProfile
      );

      if (
        !currentProfile.organizationId
      ) {
        setReports([]);

        return;
      }

      const reportsQuery =
        query(
          collection(
            db,
            "reports"
          ),
          where(
            "organizationId",
            "==",
            currentProfile.organizationId
          )
        );

      const snapshot =
        await getDocs(
          reportsQuery
        );

      const organizationReports: Report[] =
        snapshot.docs
          .map(
            (
              reportDoc
            ) => ({
              id:
                reportDoc.id,

              ...(reportDoc.data() as Omit<
                Report,
                "id"
              >),
            })
          )
          .filter(
            (
              report
            ) =>
              typeof report.latitude ===
                "number" &&
              typeof report.longitude ===
                "number"
          );

      setReports(
        organizationReports
      );
    } catch (err) {
      console.error(
        "Map load error:",
        err
      );

      setError(
        "Unable to load organisation reports."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (
      authLoading
    ) {
      return;
    }

    if (!user) {
      router.replace(
        "/login"
      );

      return;
    }

    loadData();
  }, [
    user,
    authLoading,
  ]);

  useEffect(() => {
    if (
      loading ||
      !profile?.organizationId ||
      !mapContainerRef.current ||
      mapRef.current
    ) {
      return;
    }

    const map =
      new maplibregl.Map({
        container:
          mapContainerRef.current,

        style: {
          version:
            8,

          sources: {
            osm: {
              type:
                "raster",

              tiles: [
                "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
              ],

              tileSize:
                256,

              maxzoom:
                19,

              attribution:
                "© OpenStreetMap contributors",
            },
          },

          layers: [
            {
              id:
                "osm",

              type:
                "raster",

              source:
                "osm",
            },
          ],
        },

        center: [
          28.0473,
          -26.2041,
        ],

        zoom:
          11,

        maxZoom:
          19,
      });

    map.addControl(
      new maplibregl.NavigationControl(),
      "top-right"
    );

    map.on(
      "load",
      () => {
        setMapReady(
          true
        );
      }
    );

    mapRef.current =
      map;

    return () => {
      markersRef.current.forEach(
        (
          marker
        ) =>
          marker.remove()
      );

      markersRef.current =
        [];

      if (
        userMarkerRef.current
      ) {
        userMarkerRef.current.remove();

        userMarkerRef.current =
          null;
      }

      map.remove();

      mapRef.current =
        null;

      setMapReady(
        false
      );
    };
  }, [
    loading,
    profile?.organizationId,
  ]);

  const categories =
    useMemo(
      () =>
        Array.from(
          new Set(
            reports
              .map(
                (
                  report
                ) =>
                  report.category
              )
              .filter(
                Boolean
              )
          )
        ).sort(),

      [
        reports,
      ]
    );

  const filteredReports =
    useMemo(
      () => {
        const normalizedSearch =
          search
            .trim()
            .toLowerCase();

        return reports.filter(
          (
            report
          ) => {
            if (
              categoryFilter !==
                "all" &&
              report.category !==
                categoryFilter
            ) {
              return false;
            }

            if (
              severityFilter !==
                "all" &&
              report.severity !==
                severityFilter
            ) {
              return false;
            }

            if (
              statusFilter !==
                "all" &&
              report.status !==
                statusFilter
            ) {
              return false;
            }

            if (
              !normalizedSearch
            ) {
              return true;
            }

            const haystack =
              [
                report.title,
                report.description,
                report.category,
                report.severity,
                report.status,
              ]
                .filter(
                  Boolean
                )
                .join(
                  " "
                )
                .toLowerCase();

            return haystack.includes(
              normalizedSearch
            );
          }
        );
      },

      [
        reports,
        search,
        categoryFilter,
        severityFilter,
        statusFilter,
      ]
    );

  useEffect(() => {
    const map =
      mapRef.current;

    if (
      !map ||
      !mapReady
    ) {
      return;
    }

    markersRef.current.forEach(
      (
        marker
      ) =>
        marker.remove()
    );

    markersRef.current =
      [];

    if (
      filteredReports.length ===
      0
    ) {
      return;
    }

    const bounds =
      new maplibregl.LngLatBounds();

    filteredReports.forEach(
      (
        report
      ) => {
        const markerElement =
          document.createElement(
            "div"
          );

        markerElement.style.width =
          "48px";

        markerElement.style.height =
          "48px";

        markerElement.style.borderRadius =
          "9999px";

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
          getCategoryEmoji(
            report.category
          );

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

        const popupContainer =
          document.createElement(
            "div"
          );

        popupContainer.style.minWidth =
          "220px";

        popupContainer.style.color =
          "#111827";
        popupContainer.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

        const titleElement =
          document.createElement(
            "h3"
          );

        titleElement.textContent =
          report.title;

        titleElement.style.fontWeight =
          "700";

        titleElement.style.fontSize =
          "16px";

        titleElement.style.marginBottom =
          "8px";

        const categoryElement =
          document.createElement(
            "p"
          );

        categoryElement.textContent =
          `${getCategoryEmoji(
            report.category
          )} ${report.category}`;

        categoryElement.style.marginBottom =
          "4px";

        const severityElement =
          document.createElement(
            "p"
          );

        severityElement.textContent =
          `Severity: ${report.severity}`;

        severityElement.style.textTransform =
          "capitalize";

        severityElement.style.marginBottom =
          "4px";

        const statusElement =
          document.createElement(
            "p"
          );

        statusElement.textContent =
          `Status: ${getStatusLabel(
            report.status
          )}`;

        statusElement.style.marginBottom =
          "4px";

        const confirmationElement =
          document.createElement(
            "p"
          );

        confirmationElement.textContent =
          `Confirmations: ${
            report.confirmationCount ??
            0
          }`;

        confirmationElement.style.marginBottom =
          "10px";

        const linkButton =
          document.createElement(
            "button"
          );

        linkButton.textContent =
          "View Report";

        linkButton.style.width =
          "100%";

        linkButton.style.padding =
          "8px 12px";

        linkButton.style.borderRadius =
          "8px";

        linkButton.style.background =
          "#2563eb";

        linkButton.style.color =
          "white";

        linkButton.style.fontWeight =
          "600";

        linkButton.style.border = "none";
        linkButton.style.cursor =
          "pointer";

        linkButton.addEventListener(
          "click",
          () => {
            router.push(
              `/report/${report.id}`
            );
          }
        );

        popupContainer.appendChild(
          titleElement
        );

        popupContainer.appendChild(
          categoryElement
        );

        popupContainer.appendChild(
          severityElement
        );

        popupContainer.appendChild(
          statusElement
        );

        popupContainer.appendChild(
          confirmationElement
        );

        popupContainer.appendChild(
          linkButton
        );

        const popup =
          new maplibregl.Popup({
            offset:
              28,
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
            .setPopup(
              popup
            )
            .addTo(
              map
            );

        markersRef.current.push(
          marker
        );

        bounds.extend([
          report.longitude,
          report.latitude,
        ]);
      }
    );

    if (
      filteredReports.length ===
      1
    ) {
      const first =
        filteredReports[0];

      map.flyTo({
        center: [
          first.longitude,
          first.latitude,
        ],

        zoom:
          15,
      });

      return;
    }

    map.fitBounds(
      bounds,
      {
        padding:
          80,

        maxZoom:
          15,

        duration:
          800,
      }
    );
  }, [
    filteredReports,
    mapReady,
    router,
  ]);

  function handleFindMyLocation() {
    if (
      !navigator.geolocation
    ) {
      setError(
        "Geolocation is not supported by your browser."
      );

      return;
    }

    setLocating(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (
        position
      ) => {
        const latitude =
          position.coords.latitude;

        const longitude =
          position.coords.longitude;

        const map =
          mapRef.current;

        if (
          !map
        ) {
          setLocating(
            false
          );

          return;
        }

        if (
          userMarkerRef.current
        ) {
          userMarkerRef.current.remove();
        }

        const markerElement =
          document.createElement(
            "div"
          );

        markerElement.style.width =
          "22px";

        markerElement.style.height =
          "22px";

        markerElement.style.borderRadius =
          "9999px";

        markerElement.style.background =
          "#3b82f6";

        markerElement.style.border =
          "4px solid white";

        markerElement.style.boxShadow =
          "0 0 0 4px rgba(59,130,246,0.25)";

        const marker =
          new maplibregl.Marker({
            element:
              markerElement,
          })
            .setLngLat([
              longitude,
              latitude,
            ])
            .addTo(
              map
            );

        userMarkerRef.current =
          marker;

        map.flyTo({
          center: [
            longitude,
            latitude,
          ],

          zoom:
            15,
        });

        setLocating(
          false
        );
      },

      (
        geolocationError
      ) => {
        console.error(
          "Location error:",
          geolocationError
        );

        setError(
          "Unable to get your current location."
        );

        setLocating(
          false
        );
      },

      {
        enableHighAccuracy:
          true,

        timeout:
          15000,
      }
    );
  }

  function clearFilters() {
    setSearch("");

    setCategoryFilter(
      "all"
    );

    setSeverityFilter(
      "all"
    );

    setStatusFilter(
      "all"
    );
  }

  if (
    authLoading ||
    loading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />

          <p className="mt-4 text-muted-foreground">
            Loading community map...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  if (
    !profile?.organizationId
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-muted">
            <MapPin className="h-8 w-8 text-primary" />
          </div>

          <h1 className="mt-5 text-3xl font-bold">
            No Organisation
          </h1>

          <p className="mt-3 leading-7 text-muted-foreground">
            Your account must belong to an organisation before you can access its community map.
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/dashboard"
              )
            }
            className="mt-6 btn-primary"
          >
            Dashboard
          </button>
        </div>
      </main>
    );
  }

  const filtersActive =
    !!search ||
    categoryFilter !==
      "all" ||
    severityFilter !==
      "all" ||
    statusFilter !==
      "all";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl p-6 lg:p-8">
        <header className="flex flex-col gap-5 border-b border-border pb-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Community Map
            </p>

            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              {
                profile.organizationName ||
                "CivicPulse"
              }
            </h1>

            <p className="mt-2 text-muted-foreground">
              Explore reported issues across your organisation.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={
                handleFindMyLocation
              }
              disabled={
                locating
              }
              className="btn-secondary"
            >
              <Locate className="h-4 w-4" />
              <span>{locating ? "Locating..." : "Find My Location"}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/report/new"
                )
              }
              className="btn-secondary"
            >
              <Plus className="h-4 w-4" />
              <span>Report Issue</span>
            </button>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/dashboard"
                )
              }
              className="btn-primary"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="mt-6 rounded-xl border border-danger/30 bg-danger-muted/30 p-4 text-danger">
            {
              error
            }
          </div>
        )}

        <section className="mt-6 card">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={
                  search
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search map..."
                className="input pl-10"
              />
            </div>

            <select
              value={
                categoryFilter
              }
              onChange={(
                event
              ) =>
                setCategoryFilter(
                  event.target.value
                )
              }
              className="input"
            >
              <option value="all">
                All Categories
              </option>

              {categories.map(
                (
                  category
                ) => (
                  <option
                    key={
                      category
                    }
                    value={
                      category
                    }
                  >
                    {
                      category
                    }
                  </option>
                )
              )}
            </select>

            <select
              value={
                severityFilter
              }
              onChange={(
                event
              ) =>
                setSeverityFilter(
                  event.target.value
                )
              }
              className="input"
            >
              <option value="all">
                All Severities
              </option>

              <option value="critical">
                Critical
              </option>

              <option value="high">
                High
              </option>

              <option value="medium">
                Medium
              </option>

              <option value="low">
                Low
              </option>
            </select>

            <select
              value={
                statusFilter
              }
              onChange={(
                event
              ) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className="input"
            >
              <option value="all">
                All Statuses
              </option>

              <option value="submitted">
                Submitted
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

              <option value="reopened">
                Reopened
              </option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-semibold text-foreground">
                {
                  filteredReports.length
                }
              </span>{" "}
              of{" "}
              <span className="font-semibold text-foreground">
                {
                  reports.length
                }
              </span>{" "}
              reports
            </p>

            {filtersActive && (
              <button
                type="button"
                onClick={
                  clearFilters
                }
                className="text-sm font-semibold text-primary hover:underline"
              >
                Clear Filters
              </button>
            )}
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
          <div
            ref={
              mapContainerRef
            }
            className="h-[65vh] min-h-[520px] w-full"
          />
        </section>

        <section className="mt-6 card">
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Map Legend
          </p>

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>🕳️ Pothole</span>

            <span>💧 Water Leak</span>

            <span>⚡ Power Outage</span>

            <span>💡 Streetlight</span>

            <span>⚠️ Dumping</span>

            <span>🚧 Road Hazard</span>

            <span>☣️ Sewer</span>

            <span>🧱 Vandalism</span>

            <span>📍 Other</span>
          </div>

          <div className="mt-5 flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-600" />
              Critical
            </span>

            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-orange-600" />
              High
            </span>

            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-yellow-600" />
              Medium
            </span>

            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-green-600" />
              Low
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}