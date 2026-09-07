"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/AuthContext";

const categories = [
  "Pothole",
  "Water Leak",
  "Power Outage",
  "Broken Streetlight",
  "Illegal Dumping",
  "Road Hazard",
  "Sewer Issue",
  "Vandalism",
  "Other",
];

const severities = [
  "low",
  "medium",
  "high",
  "critical",
];

type ExistingReport = {
  id: string;
  title: string;
  category: string;
  status: string;
  latitude: number;
  longitude: number;
  createdBy?: string;
  confirmationCount?: number;
  confirmedBy?: string[];
};

type DuplicateMatch = ExistingReport & {
  distance: number;
};

function calculateDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadius = 6371000;

  const toRadians = (degrees: number) =>
    (degrees * Math.PI) / 180;

  const latitude1 = toRadians(lat1);
  const latitude2 = toRadians(lat2);

  const deltaLatitude =
    toRadians(lat2 - lat1);

  const deltaLongitude =
    toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaLatitude / 2) *
      Math.sin(deltaLatitude / 2) +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(deltaLongitude / 2) *
      Math.sin(deltaLongitude / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadius * c;
}

export default function CreateReportPage() {
  const router = useRouter();

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Pothole");
  const [severity, setSeverity] = useState("medium");

  const [latitude, setLatitude] =
    useState<number | null>(null);

  const [longitude, setLongitude] =
    useState<number | null>(null);

  const [photo, setPhoto] =
    useState<File | null>(null);

  const [photoPreview, setPhotoPreview] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const [duplicateMatches, setDuplicateMatches] =
    useState<DuplicateMatch[]>([]);

  const [checkedForDuplicates, setCheckedForDuplicates] =
    useState(false);

  const [allowDuplicateSubmit, setAllowDuplicateSubmit] =
    useState(false);

  const [error, setError] = useState("");

  async function checkForDuplicates(
    currentLatitude: number,
    currentLongitude: number,
    currentCategory: string
  ) {
    try {
      setDuplicateLoading(true);
      setDuplicateMatches([]);
      setCheckedForDuplicates(false);

      const snapshot =
        await getDocs(
          collection(db, "reports")
        );

      const nearbyMatches: DuplicateMatch[] = [];

      snapshot.docs.forEach((document) => {
        const data =
          document.data() as Omit<
            ExistingReport,
            "id"
          >;

        if (
          typeof data.latitude !== "number" ||
          typeof data.longitude !== "number"
        ) {
          return;
        }

        if (data.category !== currentCategory) {
          return;
        }

        if (data.status === "resolved") {
          return;
        }

        const distance =
          calculateDistanceInMeters(
            currentLatitude,
            currentLongitude,
            data.latitude,
            data.longitude
          );

        if (distance <= 50) {
          nearbyMatches.push({
            id: document.id,
            ...data,
            distance,
          });
        }
      });

      nearbyMatches.sort(
        (a, b) => a.distance - b.distance
      );

      setDuplicateMatches(nearbyMatches);
      setCheckedForDuplicates(true);
      setAllowDuplicateSubmit(
        nearbyMatches.length === 0
      );
    } catch (err) {
      console.error(
        "Duplicate check error:",
        err
      );

      setError(
        "Unable to check nearby reports."
      );
    } finally {
      setDuplicateLoading(false);
    }
  }

  function getLocation() {
    setLocationLoading(true);
    setError("");

    if (!navigator.geolocation) {
      setError(
        "Geolocation is not supported by your browser."
      );

      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const currentLatitude =
          position.coords.latitude;

        const currentLongitude =
          position.coords.longitude;

        setLatitude(currentLatitude);
        setLongitude(currentLongitude);

        setLocationLoading(false);
        setAllowDuplicateSubmit(false);

        await checkForDuplicates(
          currentLatitude,
          currentLongitude,
          category
        );
      },

      (err) => {
        console.error(err);

        setError(
          "Unable to get your location."
        );

        setLocationLoading(false);
      },

      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  }

  async function handleCategoryChange(
    newCategory: string
  ) {
    setCategory(newCategory);

    setAllowDuplicateSubmit(false);
    setDuplicateMatches([]);
    setCheckedForDuplicates(false);

    if (
      latitude !== null &&
      longitude !== null
    ) {
      await checkForDuplicates(
        latitude,
        longitude,
        newCategory
      );
    }
  }

  function handlePhotoChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setPhoto(file);

    const preview =
      URL.createObjectURL(file);

    setPhotoPreview(preview);
  }

  async function uploadPhoto() {
    if (!photo) {
      return null;
    }

    const cloudName =
      process.env
        .NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

    const uploadPreset =
      process.env
        .NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (
      !cloudName ||
      !uploadPreset
    ) {
      throw new Error(
        "Cloudinary environment variables are missing."
      );
    }

    const formData =
      new FormData();

    formData.append(
      "file",
      photo
    );

    formData.append(
      "upload_preset",
      uploadPreset
    );

    const response =
      await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

    if (!response.ok) {
      throw new Error(
        "Photo upload failed."
      );
    }

    const data =
      await response.json();

    return data.secure_url as string;
  }

  async function handleConfirmExisting(
    match: DuplicateMatch
  ) {
    if (!user) {
      router.push("/login");
      return;
    }

    if (match.createdBy === user.uid) {
      setError(
        "You cannot confirm your own report."
      );
      return;
    }

    try {
      setConfirmingId(match.id);
      setError("");

      const reportRef =
        doc(
          db,
          "reports",
          match.id
        );

      const snapshot =
        await getDoc(reportRef);

      if (!snapshot.exists()) {
        setError(
          "That report no longer exists."
        );

        return;
      }

      const currentData =
        snapshot.data();

      const confirmedBy =
        Array.isArray(
          currentData.confirmedBy
        )
          ? currentData.confirmedBy
          : [];

      if (
        confirmedBy.includes(
          user.uid
        )
      ) {
        setError(
          "You have already confirmed this report."
        );

        return;
      }

      await updateDoc(
        reportRef,
        {
          confirmationCount:
            increment(1),

          confirmedBy:
            arrayUnion(
              user.uid
            ),

          updatedAt:
            serverTimestamp(),
        }
      );

      router.push(
        `/report/${match.id}`
      );
    } catch (err) {
      console.error(
        "Confirm existing error:",
        err
      );

      setError(
        "Failed to confirm the existing report."
      );
    } finally {
      setConfirmingId(null);
    }
  }

  async function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!user) {
      setError(
        "You must be logged in to create a report."
      );

      return;
    }

    if (
      latitude === null ||
      longitude === null
    ) {
      setError(
        "Please capture your location first."
      );

      return;
    }

    if (
      !checkedForDuplicates
    ) {
      setError(
        "Please wait for the nearby-report check to complete."
      );

      return;
    }

    if (
      duplicateMatches.length > 0 &&
      !allowDuplicateSubmit
    ) {
      setError(
        "A similar nearby report already exists. Confirm it, view it, or choose Continue Anyway."
      );

      return;
    }

    setLoading(true);
    setError("");

    try {
      const imageUrl =
        await uploadPhoto();

      const reportRef =
        await addDoc(
          collection(
            db,
            "reports"
          ),
          {
            title,
            description,
            category,
            severity,
            status:
              "submitted",

            latitude,
            longitude,

            imageUrl,

            createdBy:
              user.uid,

            createdByEmail:
              user.email,

            confirmationCount:
              0,

            confirmedBy: [],

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          }
        );

      router.push(
        `/report/${reportRef.id}`
      );
    } catch (err) {
      console.error(
        "Create report error:",
        err
      );

      if (
        err instanceof Error
      ) {
        setError(
          err.message
        );
      } else {
        setError(
          "Failed to create report."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        Loading...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            Login required
          </h1>

          <button
            onClick={() =>
              router.push(
                "/login"
              )
            }
            className="mt-4 rounded-lg bg-blue-600 px-5 py-3 font-semibold"
          >
            Go to login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() =>
            router.back()
          }
          className="mb-6 text-gray-400 hover:text-white"
        >
          ← Back
        </button>

        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8">
          <h1 className="text-3xl font-bold">
            Report an Issue
          </h1>

          <p className="mt-2 text-gray-400">
            Tell your community about a problem that needs attention.
          </p>

          <form
            onSubmit={
              handleSubmit
            }
            className="mt-8 space-y-6"
          >
            <div>
              <label className="mb-2 block text-sm font-medium">
                Issue title
              </label>

              <input
                type="text"
                value={title}
                onChange={(e) =>
                  setTitle(
                    e.target.value
                  )
                }
                required
                placeholder="Large pothole on Main Road"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Category
              </label>

              <select
                value={category}
                onChange={(e) =>
                  handleCategoryChange(
                    e.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 outline-none"
              >
                {categories.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Severity
              </label>

              <select
                value={severity}
                onChange={(e) =>
                  setSeverity(
                    e.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 outline-none"
              >
                {severities.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item
                        .charAt(0)
                        .toUpperCase() +
                        item.slice(1)}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Description
              </label>

              <textarea
                value={description}
                onChange={(e) =>
                  setDescription(
                    e.target.value
                  )
                }
                required
                rows={5}
                placeholder="Describe what happened, where it is, and why it needs attention..."
                className="w-full resize-none rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Location
              </label>

              <button
                type="button"
                onClick={
                  getLocation
                }
                disabled={
                  locationLoading ||
                  duplicateLoading
                }
                className="rounded-lg border border-gray-700 px-4 py-3 hover:bg-gray-800 disabled:opacity-50"
              >
                {locationLoading
                  ? "Getting location..."
                  : duplicateLoading
                  ? "Checking nearby reports..."
                  : "Use my current location"}
              </button>

              {latitude !== null &&
                longitude !== null && (
                  <div className="mt-3 rounded-lg bg-gray-800 p-4 text-sm text-gray-300">
                    <p>
                      Latitude:{" "}
                      {latitude.toFixed(
                        6
                      )}
                    </p>

                    <p>
                      Longitude:{" "}
                      {longitude.toFixed(
                        6
                      )}
                    </p>
                  </div>
                )}
            </div>

            {duplicateLoading && (
              <div className="rounded-xl border border-blue-900 bg-blue-950/30 p-5">
                <p className="font-semibold text-blue-300">
                  Checking for nearby reports...
                </p>

                <p className="mt-1 text-sm text-gray-400">
                  CivicPulse is checking whether this issue may already have been reported nearby.
                </p>
              </div>
            )}

            {!duplicateLoading &&
              checkedForDuplicates &&
              duplicateMatches.length === 0 && (
                <div className="rounded-xl border border-green-900 bg-green-950/30 p-5">
                  <p className="font-semibold text-green-300">
                    ✓ No nearby duplicate found
                  </p>

                  <p className="mt-1 text-sm text-gray-400">
                    No unresolved {category.toLowerCase()} reports were found within 50 metres.
                  </p>
                </div>
              )}

            {!duplicateLoading &&
              duplicateMatches.length > 0 && (
                <div className="rounded-2xl border border-yellow-700 bg-yellow-950/30 p-5">
                  <h2 className="text-lg font-bold text-yellow-300">
                    ⚠️ Possible existing report
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-gray-300">
                    CivicPulse found a similar unresolved issue nearby.
                    You can confirm the existing report instead of creating another one.
                  </p>

                  <div className="mt-5 space-y-3">
                    {duplicateMatches
                      .slice(0, 3)
                      .map(
                        (match) => (
                          <div
                            key={
                              match.id
                            }
                            className="rounded-xl border border-gray-700 bg-gray-900 p-4"
                          >
                            <p className="font-semibold">
                              {match.title}
                            </p>

                            <p className="mt-1 text-sm text-gray-400">
                              {Math.round(
                                match.distance
                              )}{" "}
                              metres away
                            </p>

                            <p className="mt-1 text-sm text-gray-400">
                              {match.confirmationCount ?? 0} confirmations
                            </p>

                            <div className="mt-4 flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    `/report/${match.id}`
                                  )
                                }
                                className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-semibold hover:bg-gray-800"
                              >
                                View Existing
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleConfirmExisting(
                                    match
                                  )
                                }
                                disabled={
                                  confirmingId ===
                                  match.id
                                }
                                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold hover:bg-green-500 disabled:opacity-50"
                              >
                                {confirmingId ===
                                match.id
                                  ? "Confirming..."
                                  : "Confirm Existing"}
                              </button>
                            </div>
                          </div>
                        )
                      )}
                  </div>

                  {!allowDuplicateSubmit ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAllowDuplicateSubmit(
                          true
                        );
                        setError("");
                      }}
                      className="mt-5 rounded-lg bg-yellow-600 px-5 py-3 font-semibold text-black hover:bg-yellow-500"
                    >
                      Continue Anyway
                    </button>
                  ) : (
                    <div className="mt-5 rounded-lg border border-yellow-700 bg-yellow-900/30 p-4 text-sm text-yellow-200">
                      You chose to continue with a new report.
                    </div>
                  )}
                </div>
              )}

            <div>
              <label className="mb-2 block text-sm font-medium">
                Photo
              </label>

              <input
                type="file"
                accept="image/*"
                onChange={
                  handlePhotoChange
                }
                className="block w-full text-sm text-gray-400"
              />

              {photoPreview && (
                <img
                  src={
                    photoPreview
                  }
                  alt="Report preview"
                  className="mt-4 max-h-80 w-full rounded-xl object-cover"
                />
              )}
            </div>

            {error && (
              <div className="rounded-lg border border-red-900 bg-red-950/50 p-4 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={
                loading ||
                locationLoading ||
                duplicateLoading
              }
              className="w-full rounded-lg bg-blue-600 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
            >
              {loading
                ? "Submitting report..."
                : "Submit report"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}