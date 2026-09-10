"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  db,
} from "@/src/lib/firebase";

import {
  useAuth,
} from "@/src/lib/AuthContext";

type UserProfile = {
  uid?: string;
  name?: string;
  email?: string;
  role?: string;

  organizationId?: string | null;
  organizationName?: string | null;
};

type ExistingReport = {
  id: string;
  title: string;
  category: string;
  status: string;
  latitude: number;
  longitude: number;
  confirmationCount?: number;
  confirmedBy?: string[];
  organizationId?: string | null;
};

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

function toRadians(
  degrees: number
) {
  return (
    degrees *
    (Math.PI / 180)
  );
}

function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadius =
    6371000;

  const dLat =
    toRadians(
      lat2 - lat1
    );

  const dLon =
    toRadians(
      lon2 - lon1
    );

  const a =
    Math.sin(
      dLat / 2
    ) *
      Math.sin(
        dLat / 2
      ) +
    Math.cos(
      toRadians(
        lat1
      )
    ) *
      Math.cos(
        toRadians(
          lat2
        )
      ) *
      Math.sin(
        dLon / 2
      ) *
      Math.sin(
        dLon / 2
      );

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return (
    earthRadius *
    c
  );
}

function isResolvedStatus(
  status?: string
) {
  return (
    status ===
      "resolved" ||
    status ===
      "rejected" ||
    status ===
      "duplicate"
  );
}

export default function NewReportPage() {
  const router =
    useRouter();

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const [
    profile,
    setProfile,
  ] =
    useState<UserProfile | null>(
      null
    );

  const [
    title,
    setTitle,
  ] =
    useState("");

  const [
    description,
    setDescription,
  ] =
    useState("");

  const [
    category,
    setCategory,
  ] =
    useState(
      "Pothole"
    );

  const [
    severity,
    setSeverity,
  ] =
    useState(
      "medium"
    );

  const [
    latitude,
    setLatitude,
  ] =
    useState<number | null>(
      null
    );

  const [
    longitude,
    setLongitude,
  ] =
    useState<number | null>(
      null
    );

  const [
    imageFile,
    setImageFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    imagePreview,
    setImagePreview,
  ] =
    useState<string | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    locating,
    setLocating,
  ] =
    useState(false);

  const [
    profileLoading,
    setProfileLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    duplicateReport,
    setDuplicateReport,
  ] =
    useState<ExistingReport | null>(
      null
    );

  const [
    checkingDuplicate,
    setCheckingDuplicate,
  ] =
    useState(false);

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

    const currentUser = user;

    async function loadProfile() {
      try {
        setProfileLoading(true);

        const profileRef =
          doc(
            db,
            "users",
            currentUser.uid
          );

        const snapshot =
          await getDoc(
            profileRef
          );

        if (
          snapshot.exists()
        ) {
          setProfile(
            snapshot.data() as UserProfile
          );
        } else {
          setProfile({
            uid:
              currentUser.uid,

            email:
              currentUser.email ?? "",

            role:
              "resident",

            organizationId:
              null,

            organizationName:
              null,
          });
        }
      } catch (err) {
        console.error(
          "Load profile error:",
          err
        );

        setProfile({
          uid:
            currentUser.uid,

          email:
            currentUser.email ?? "",

          role:
            "resident",

          organizationId:
            null,

          organizationName:
            null,
        });
      } finally {
        setProfileLoading(false);
      }
    }

    loadProfile();
  }, [
    user,
    authLoading,
    router,
  ]);

  useEffect(() => {
    return () => {
      if (
        imagePreview
      ) {
        URL.revokeObjectURL(
          imagePreview
        );
      }
    };
  }, [
    imagePreview,
  ]);

  const canSubmit =
    useMemo(
      () =>
        !!title.trim() &&
        !!description.trim() &&
        latitude !== null &&
        longitude !== null &&
        !!user &&
        !loading &&
        !checkingDuplicate,

      [
        title,
        description,
        latitude,
        longitude,
        user,
        loading,
        checkingDuplicate,
      ]
    );

  function handleImageChange(
    event:
      React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0] ??
      null;

    setImageFile(
      file
    );

    if (
      imagePreview
    ) {
      URL.revokeObjectURL(
        imagePreview
      );
    }

    if (
      file
    ) {
      setImagePreview(
        URL.createObjectURL(
          file
        )
      );
    } else {
      setImagePreview(
        null
      );
    }
  }

  function getLocation() {
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
        setLatitude(
          position.coords.latitude
        );

        setLongitude(
          position.coords.longitude
        );

        setLocating(false);
      },

      (
        geolocationError
      ) => {
        console.error(
          "Location error:",
          geolocationError
        );

        setError(
          "Unable to get your location. Please allow location access and try again."
        );

        setLocating(false);
      },

      {
        enableHighAccuracy:
          true,

        timeout:
          15000,
      }
    );
  }

  async function uploadImage() {
    if (
      !imageFile
    ) {
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
        "Cloudinary configuration is missing."
      );
    }

    const formData =
      new FormData();

    formData.append(
      "file",
      imageFile
    );

    formData.append(
      "upload_preset",
      uploadPreset
    );

    const response =
      await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method:
            "POST",

          body:
            formData,
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        "Image upload failed."
      );
    }

    const result =
      await response.json();

    return (
      result.secure_url ??
      null
    );
  }

  async function findDuplicate() {
    if (
      latitude === null ||
      longitude === null
    ) {
      return null;
    }

    const organizationId =
      profile?.organizationId;

    if (!organizationId) {
      return null;
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
          organizationId
        )
      );

    const snapshot =
      await getDocs(
        reportsQuery
      );

    const sameTenantReports =
      snapshot.docs.map(
        (
          reportDoc
        ) => ({
          id:
            reportDoc.id,

          ...reportDoc.data(),
        })
      ) as ExistingReport[];

    const duplicate =
      sameTenantReports.find(
        (
          existing
        ) => {
          if (
            existing.category !==
            category
          ) {
            return false;
          }

          if (
            isResolvedStatus(
              existing.status
            )
          ) {
            return false;
          }

          if (
            typeof existing.latitude !==
              "number" ||
            typeof existing.longitude !==
              "number"
          ) {
            return false;
          }

          const distance =
            calculateDistanceMeters(
              latitude,
              longitude,
              existing.latitude,
              existing.longitude
            );

          return (
            distance <= 50
          );
        }
      );

    return (
      duplicate ??
      null
    );
  }

  async function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!user) {
      router.push(
        "/login"
      );

      return;
    }

    if (
      latitude === null ||
      longitude === null
    ) {
      setError(
        "Please add your location before submitting."
      );

      return;
    }

    try {
      setCheckingDuplicate(true);
      setError("");

      const duplicate =
        await findDuplicate();

      if (
        duplicate
      ) {
        setDuplicateReport(
          duplicate
        );

        return;
      }

      await createNewReport();
    } catch (err) {
      console.error(
        "Report validation error:",
        err
      );

      setError(
        "Unable to check this report. Please try again."
      );
    } finally {
      setCheckingDuplicate(false);
    }
  }

  async function createNewReport() {
    if (
      !user ||
      latitude === null ||
      longitude === null
    ) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const imageUrl =
        await uploadImage();

      const reportRef =
        await addDoc(
          collection(
            db,
            "reports"
          ),
          {
            title:
              title.trim(),

            description:
              description.trim(),

            category,

            severity,

            status:
              "submitted",

            statusHistory: [
              {
                status:
                  "submitted",

                changedAt:
                  new Date(),

                changedBy:
                  user.uid,
              },
            ],

            latitude,

            longitude,

            imageUrl,

            createdBy:
              user.uid,

            organizationId:
              profile?.organizationId ??
              null,

            organizationName:
              profile?.organizationName ??
              null,

            confirmationCount:
              0,

            confirmedBy:
              [],

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

      setError(
        "Failed to create report."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmExisting() {
    if (
      !user ||
      !duplicateReport
    ) {
      return;
    }

    if (
      duplicateReport.confirmedBy?.includes(
        user.uid
      )
    ) {
      router.push(
        `/report/${duplicateReport.id}`
      );

      return;
    }

    try {
      setLoading(true);
      setError("");

      const reportRef =
        doc(
          db,
          "reports",
          duplicateReport.id
        );

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
        `/report/${duplicateReport.id}`
      );
    } catch (err) {
      console.error(
        "Confirm duplicate error:",
        err
      );

      setError(
        "Failed to confirm the existing report."
      );
    } finally {
      setLoading(false);
    }
  }

  if (
    authLoading ||
    profileLoading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        Loading...
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-950 p-6 text-white">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() =>
            router.push(
              "/dashboard"
            )
          }
          className="text-gray-400 hover:text-white"
        >
          ← Dashboard
        </button>

        <div className="mt-8 rounded-2xl border border-gray-800 bg-gray-900 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
            New Civic Report
          </p>

          <h1 className="mt-3 text-4xl font-bold">
            Report an Issue
          </h1>

          <p className="mt-3 text-gray-400">
            Submit a local issue so the community and responsible team can track it.
          </p>

          {profile?.organizationName && (
            <div className="mt-5 rounded-xl border border-indigo-900 bg-indigo-950/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                Organisation
              </p>

              <p className="mt-1 font-semibold">
                {
                  profile.organizationName
                }
              </p>
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-xl border border-red-900 bg-red-950/30 p-4 text-red-300">
              {error}
            </div>
          )}

          <form
            onSubmit={
              handleSubmit
            }
            className="mt-8 space-y-6"
          >
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Title
              </label>

              <input
                type="text"
                value={title}
                onChange={(
                  event
                ) =>
                  setTitle(
                    event.target.value
                  )
                }
                required
                maxLength={120}
                placeholder="Example: Large pothole on Main Road"
                className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Description
              </label>

              <textarea
                value={
                  description
                }
                onChange={(
                  event
                ) =>
                  setDescription(
                    event.target.value
                  )
                }
                required
                maxLength={1500}
                rows={5}
                placeholder="Describe the issue..."
                className="w-full resize-none rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Category
                </label>

                <select
                  value={
                    category
                  }
                  onChange={(
                    event
                  ) =>
                    setCategory(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500"
                >
                  {categories.map(
                    (
                      item
                    ) => (
                      <option
                        key={
                          item
                        }
                        value={
                          item
                        }
                      >
                        {item}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Severity
                </label>

                <select
                  value={
                    severity
                  }
                  onChange={(
                    event
                  ) =>
                    setSeverity(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 capitalize outline-none focus:border-blue-500"
                >
                  {severities.map(
                    (
                      item
                    ) => (
                      <option
                        key={
                          item
                        }
                        value={
                          item
                        }
                      >
                        {item}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Photo
              </label>

              <input
                type="file"
                accept="image/*"
                onChange={
                  handleImageChange
                }
                className="block w-full rounded-xl border border-gray-700 bg-gray-950 p-3 text-sm text-gray-300"
              />

              {imagePreview && (
                <img
                  src={
                    imagePreview
                  }
                  alt="Report preview"
                  className="mt-4 h-64 w-full rounded-xl object-cover"
                />
              )}
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">
                    Report Location
                  </p>

                  {latitude !== null &&
                  longitude !== null ? (
                    <p className="mt-2 text-sm text-green-400">
                      {latitude.toFixed(
                        6
                      )}
                      ,{" "}
                      {longitude.toFixed(
                        6
                      )}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500">
                      Location not added yet.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={
                    getLocation
                  }
                  disabled={
                    locating
                  }
                  className="rounded-lg bg-gray-800 px-4 py-3 font-semibold hover:bg-gray-700 disabled:opacity-50"
                >
                  {locating
                    ? "Locating..."
                    : "📍 Use My Location"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={
                !canSubmit
              }
              className="w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checkingDuplicate
                ? "Checking for nearby reports..."
                : loading
                ? "Submitting..."
                : "Submit Report"}
            </button>
          </form>
        </div>
      </div>

      {duplicateReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6">
          <div className="w-full max-w-lg rounded-2xl border border-yellow-800 bg-gray-900 p-7">
            <div className="text-4xl">
              ⚠️
            </div>

            <h2 className="mt-4 text-2xl font-bold">
              Possible Duplicate Found
            </h2>

            <p className="mt-3 leading-7 text-gray-400">
              A nearby unresolved{" "}
              <strong className="text-white">
                {
                  duplicateReport.category
                }
              </strong>{" "}
              report already exists.
            </p>

            <div className="mt-5 rounded-xl border border-gray-800 bg-gray-950 p-5">
              <p className="font-bold">
                {
                  duplicateReport.title
                }
              </p>

              <p className="mt-2 text-sm text-gray-400">
                Confirmations:{" "}
                {duplicateReport.confirmationCount ??
                  0}
              </p>
            </div>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/report/${duplicateReport.id}`
                  )
                }
                className="rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500"
              >
                View Existing Report
              </button>

              <button
                type="button"
                onClick={
                  handleConfirmExisting
                }
                disabled={loading}
                className="rounded-lg bg-green-600 px-5 py-3 font-semibold hover:bg-green-500 disabled:opacity-50"
              >
                Confirm Existing Issue
              </button>

              <button
                type="button"
                onClick={async () => {
                  setDuplicateReport(
                    null
                  );

                  await createNewReport();
                }}
                disabled={loading}
                className="rounded-lg border border-gray-700 px-5 py-3 font-semibold hover:bg-gray-800 disabled:opacity-50"
              >
                Continue Anyway
              </button>

              <button
                type="button"
                onClick={() =>
                  setDuplicateReport(
                    null
                  )
                }
                disabled={loading}
                className="text-sm text-gray-500 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}