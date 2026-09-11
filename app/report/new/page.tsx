"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { addDoc, arrayUnion, collection, doc, getDocs, increment, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthContext";
import { Layout } from "@/src/components/Layout";
import { CATEGORIES, SEVERITIES, calculateDistanceMeters, isResolvedStatus, encodeGeohash, compressImage } from "@/src/lib/constants";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface ExistingReport {
  id: string;
  title: string;
  category: string;
  status: string;
  latitude: number;
  longitude: number;
  confirmationCount?: number;
  confirmedBy?: string[];
}

export default function NewReportPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Pothole");
  const [severity, setSeverity] = useState("medium");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [duplicateReport, setDuplicateReport] = useState<ExistingReport | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  // Map refs for pin correction
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  // Initialize/update map when coordinates change
  const initMap = useCallback((lat: number, lng: number) => {
    if (!mapContainerRef.current) return;

    // If map exists, just move marker
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
      mapRef.current.flyTo({ center: [lng, lat], zoom: 17 });
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [lng, lat],
      zoom: 17,
    });

    const marker = new maplibregl.Marker({ draggable: true, color: "#3b82f6" })
      .setLngLat([lng, lat])
      .addTo(map);

    marker.on("dragend", () => {
      const lngLat = marker.getLngLat();
      setLatitude(lngLat.lat);
      setLongitude(lngLat.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;
  }, []);

  // Init map when coords are first set
  useEffect(() => {
    if (latitude !== null && longitude !== null) {
      // Small delay for DOM render
      setTimeout(() => initMap(latitude, longitude), 100);
    }
  }, [latitude !== null && longitude !== null]);

  // Cleanup map
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  const canSubmit = useMemo(
    () => !!title.trim() && !!description.trim() && latitude !== null && longitude !== null && !!user && !loading && !checkingDuplicate,
    [title, description, latitude, longitude, user, loading, checkingDuplicate]
  );

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  function getLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setLocating(false);
      },
      (err) => {
        console.error("Location error:", err);
        setError("Unable to get your location. Please allow location access.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function uploadImage(): Promise<string | null> {
    if (!imageFile) return null;

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) throw new Error("Cloudinary configuration is missing.");

    // Compress image before upload
    let fileToUpload: Blob | File = imageFile;
    try {
      if (imageFile.type.startsWith("image/")) {
        fileToUpload = await compressImage(imageFile, 1920, 0.8);
      }
    } catch (compressErr) {
      console.warn("Image compression failed, uploading original:", compressErr);
    }

    const formData = new FormData();
    formData.append("file", fileToUpload);
    formData.append("upload_preset", uploadPreset);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) throw new Error("Image upload failed.");
    const result = await response.json();
    return result.secure_url ?? null;
  }

  async function findDuplicate(): Promise<ExistingReport | null> {
    if (latitude === null || longitude === null) return null;
    const orgId = profile?.organizationId;
    if (!orgId) return null;

    const q = query(collection(db, "reports"), where("organizationId", "==", orgId));
    const snapshot = await getDocs(q);

    const reports = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ExistingReport[];

    return reports.find((r) => {
      if (r.category !== category) return false;
      if (isResolvedStatus(r.status)) return false;
      if (typeof r.latitude !== "number" || typeof r.longitude !== "number") return false;
      return calculateDistanceMeters(latitude, longitude, r.latitude, r.longitude) <= 50;
    }) ?? null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || latitude === null || longitude === null) {
      setError("Please add your location before submitting.");
      return;
    }
    try {
      setCheckingDuplicate(true);
      setError("");
      const dup = await findDuplicate();
      if (dup) { setDuplicateReport(dup); return; }
      await createNewReport();
    } catch (err) {
      console.error("Report validation error:", err);
      setError("Unable to check this report. Please try again.");
    } finally {
      setCheckingDuplicate(false);
    }
  }

  async function createNewReport() {
    if (!user || latitude === null || longitude === null) return;
    try {
      setLoading(true);
      setError("");
      const imageUrl = await uploadImage();
      const geohash = encodeGeohash(latitude, longitude);

      const reportRef = await addDoc(collection(db, "reports"), {
        title: title.trim(),
        description: description.trim(),
        category,
        severity,
        status: "submitted",
        statusHistory: [{ status: "submitted", changedAt: new Date(), changedBy: user.uid }],
        latitude,
        longitude,
        geohash,
        imageUrl,
        createdBy: user.uid,
        createdByName: profile?.name || "",
        organizationId: profile?.organizationId ?? null,
        organizationName: profile?.organizationName ?? null,
        confirmationCount: 0,
        confirmedBy: [],
        submittedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.push(`/report/${reportRef.id}`);
    } catch (err) {
      console.error("Create report error:", err);
      setError("Failed to create report.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmExisting() {
    if (!user || !duplicateReport) return;
    if (duplicateReport.confirmedBy?.includes(user.uid)) {
      router.push(`/report/${duplicateReport.id}`);
      return;
    }
    try {
      setLoading(true);
      setError("");
      await updateDoc(doc(db, "reports", duplicateReport.id), {
        confirmationCount: increment(1),
        confirmedBy: arrayUnion(user.uid),
        updatedAt: serverTimestamp(),
      });
      router.push(`/report/${duplicateReport.id}`);
    } catch (err) {
      console.error("Confirm duplicate error:", err);
      setError("Failed to confirm the existing report.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">New Civic Report</p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Report an Issue</h1>
          <p className="mt-3 text-gray-400">Submit a local issue so the community and responsible team can track it.</p>

          {profile?.organizationName && (
            <div className="mt-5 rounded-xl border border-indigo-900 bg-indigo-950/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Organisation</p>
              <p className="mt-1 font-semibold">{profile.organizationName}</p>
            </div>
          )}

          {error && <div className="mt-6 rounded-xl border border-red-900 bg-red-950/30 p-4 text-red-300">{error}</div>}

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label htmlFor="report-title" className="mb-2 block text-sm font-semibold">Title</label>
              <input id="report-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} placeholder="Example: Large pothole on Main Road" className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500" />
            </div>

            <div>
              <label htmlFor="report-desc" className="mb-2 block text-sm font-semibold">Description</label>
              <textarea id="report-desc" value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={1500} rows={5} placeholder="Describe the issue..." className="w-full resize-none rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500" />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="report-cat" className="mb-2 block text-sm font-semibold">Category</label>
                <select id="report-cat" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="report-sev" className="mb-2 block text-sm font-semibold">Severity</label>
                <select id="report-sev" value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 capitalize outline-none focus:border-blue-500">
                  {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">Photo</label>
              <input type="file" accept="image/*" onChange={handleImageChange} className="block w-full rounded-xl border border-gray-700 bg-gray-950 p-3 text-sm text-gray-300" aria-label="Upload photo" />
              {imagePreview && <img src={imagePreview} alt="Report preview" className="mt-4 h-64 w-full rounded-xl object-cover" />}
            </div>

            {/* Location section */}
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">Report Location</p>
                  {latitude !== null && longitude !== null ? (
                    <p className="mt-2 text-sm text-green-400">{latitude.toFixed(6)}, {longitude.toFixed(6)}</p>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500">Location not added yet.</p>
                  )}
                </div>
                <button type="button" onClick={getLocation} disabled={locating} className="rounded-lg bg-gray-800 px-4 py-3 font-semibold hover:bg-gray-700 disabled:opacity-50">
                  {locating ? "Locating..." : "📍 Use My Location"}
                </button>
              </div>

              {/* Draggable map for pin correction */}
              {latitude !== null && longitude !== null && (
                <div className="mt-4">
                  <p className="mb-2 text-xs text-gray-400">Drag the marker to correct the exact location:</p>
                  <div ref={mapContainerRef} className="h-[300px] w-full rounded-xl border border-gray-700 overflow-hidden" />
                </div>
              )}
            </div>

            <button type="submit" disabled={!canSubmit} className="w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
              {checkingDuplicate ? "Checking for nearby reports..." : loading ? "Submitting..." : "Submit Report"}
            </button>
          </form>
        </div>
      </div>

      {/* Duplicate detection modal */}
      {duplicateReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6">
          <div className="w-full max-w-lg rounded-2xl border border-yellow-800 bg-gray-900 p-7">
            <div className="text-4xl">⚠️</div>
            <h2 className="mt-4 text-2xl font-bold">Possible Duplicate Found</h2>
            <p className="mt-3 leading-7 text-gray-400">
              A nearby unresolved <strong className="text-white">{duplicateReport.category}</strong> report already exists.
            </p>
            <div className="mt-5 rounded-xl border border-gray-800 bg-gray-950 p-5">
              <p className="font-bold">{duplicateReport.title}</p>
              <p className="mt-2 text-sm text-gray-400">Confirmations: {duplicateReport.confirmationCount ?? 0}</p>
            </div>
            <div className="mt-6 grid gap-3">
              <button type="button" onClick={() => router.push(`/report/${duplicateReport.id}`)} className="rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500">View Existing Report</button>
              <button type="button" onClick={handleConfirmExisting} disabled={loading} className="rounded-lg bg-green-600 px-5 py-3 font-semibold hover:bg-green-500 disabled:opacity-50">Confirm Existing Issue</button>
              <button type="button" onClick={async () => { setDuplicateReport(null); await createNewReport(); }} disabled={loading} className="rounded-lg border border-gray-700 px-5 py-3 font-semibold hover:bg-gray-800 disabled:opacity-50">Continue Anyway</button>
              <button type="button" onClick={() => setDuplicateReport(null)} disabled={loading} className="text-sm text-gray-500 hover:text-white">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}