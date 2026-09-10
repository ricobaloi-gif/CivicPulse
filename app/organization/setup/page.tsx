"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
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

const organizationTypes = [
  "Municipality",
  "Political Party",
  "NGO",
  "University",
  "School",
  "Residents Association",
  "Estate",
  "Community Organisation",
  "Private Company",
  "Other",
];

export default function OrganizationSetupPage() {
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
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    creating,
    setCreating,
  ] =
    useState(false);

  const [
    organizationName,
    setOrganizationName,
  ] =
    useState("");

  const [
    organizationType,
    setOrganizationType,
  ] =
    useState(
      "Community Organisation"
    );

  const [
    description,
    setDescription,
  ] =
    useState("");

  const [
    city,
    setCity,
  ] =
    useState("");

  const [
    province,
    setProvince,
  ] =
    useState("");

  const [
    country,
    setCountry,
  ] =
    useState(
      "South Africa"
    );

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    success,
    setSuccess,
  ] =
    useState("");

  async function loadProfile() {
    if (!user) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const userRef =
        doc(
          db,
          "users",
          user.uid
        );

      const snapshot =
        await getDoc(
          userRef
        );

      if (
        !snapshot.exists()
      ) {
        setError(
          "Your CivicPulse user profile could not be found."
        );

        return;
      }

      setProfile(
        snapshot.data() as UserProfile
      );
    } catch (err) {
      console.error(
        "Load profile error:",
        err
      );

      setError(
        "Unable to load your CivicPulse profile."
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

    loadProfile();
  }, [
    user,
    authLoading,
  ]);

  async function handleCreateOrganization(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!user) {
      return;
    }

    const role =
      profile?.role
        ?.toLowerCase()
        .trim();

    if (
      role !== "admin"
    ) {
      setError(
        "Only administrators can create an organisation."
      );

      return;
    }

    if (
      profile?.organizationId
    ) {
      setError(
        "Your account already belongs to an organisation."
      );

      return;
    }

    const trimmedName =
      organizationName.trim();

    if (!trimmedName) {
      setError(
        "Please enter an organisation name."
      );

      return;
    }

    if (
      trimmedName.length >
      120
    ) {
      setError(
        "Organisation name is too long."
      );

      return;
    }

    if (
      description.length >
      1000
    ) {
      setError(
        "Description cannot exceed 1000 characters."
      );

      return;
    }

    try {
      setCreating(true);
      setError("");
      setSuccess("");

      const organizationRef =
        await addDoc(
          collection(
            db,
            "organizations"
          ),
          {
            name:
              trimmedName,

            type:
              organizationType,

            description:
              description.trim(),

            city:
              city.trim(),

            province:
              province.trim(),

            country:
              country.trim(),

            ownerId:
              user.uid,

            createdBy:
              user.uid,

            status:
              "active",

            memberCount:
              1,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          }
        );

      const userRef =
        doc(
          db,
          "users",
          user.uid
        );

      await updateDoc(
        userRef,
        {
          organizationId:
            organizationRef.id,

          organizationName:
            trimmedName,

          organizationRole:
            "owner",
        }
      );

      setSuccess(
        `${trimmedName} was created successfully.`
      );

      await loadProfile();
    } catch (err) {
      console.error(
        "Create organization error:",
        err
      );

      setError(
        "Failed to create the organisation."
      );
    } finally {
      setCreating(false);
    }
  }

  if (
    authLoading ||
    loading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />

          <p className="mt-4 text-gray-400">
            Loading organisation setup...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const role =
    profile?.role
      ?.toLowerCase()
      .trim();

  const isAdmin =
    role === "admin";

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 p-6 text-white">
        <div className="w-full max-w-lg rounded-2xl border border-red-900 bg-gray-900 p-8 text-center">
          <div className="text-5xl">
            🔒
          </div>

          <h1 className="mt-5 text-3xl font-bold">
            Admin Only
          </h1>

          <p className="mt-3 text-gray-400">
            Only CivicPulse administrators can create an organisation.
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/dashboard"
              )
            }
            className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
          >
            Return to Dashboard
          </button>
        </div>
      </main>
    );
  }

  if (
    profile?.organizationId
  ) {
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

          <div className="mt-8 rounded-2xl border border-green-900 bg-green-950/20 p-8">
            <div className="text-5xl">
              🏢
            </div>

            <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-green-400">
              Organisation Active
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              {profile.organizationName ||
                "Your Organisation"}
            </h1>

            <p className="mt-3 text-gray-400">
              Your CivicPulse administrator account is already connected to this organisation.
            </p>

            <div className="mt-6 rounded-xl border border-gray-800 bg-gray-950 p-5">
              <p className="text-xs uppercase tracking-wider text-gray-500">
                Organisation ID
              </p>

              <p className="mt-2 break-all font-mono text-sm text-gray-300">
                {
                  profile.organizationId
                }
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/admin"
                )
              }
              className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
            >
              Open Operations
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-3xl p-6 lg:p-8">
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

        <header className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
            CivicPulse Organisations
          </p>

          <h1 className="mt-3 text-4xl font-bold">
            Create your organisation
          </h1>

          <p className="mt-3 max-w-2xl leading-7 text-gray-400">
            Organisations let CivicPulse separate reports, staff, operations and analytics between different clients.
          </p>
        </header>

        {error && (
          <div className="mt-6 rounded-xl border border-red-900 bg-red-950/30 p-4 text-red-300">
            {
              error
            }
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-xl border border-green-900 bg-green-950/30 p-4 text-green-300">
            {
              success
            }
          </div>
        )}

        <form
          onSubmit={
            handleCreateOrganization
          }
          className="mt-8 space-y-6 rounded-2xl border border-gray-800 bg-gray-900 p-8"
        >
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Organisation Name
            </label>

            <input
              type="text"
              value={
                organizationName
              }
              onChange={(
                event
              ) =>
                setOrganizationName(
                  event.target.value
                )
              }
              maxLength={
                120
              }
              required
              placeholder="Example: Tshwane Community Services"
              className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none placeholder:text-gray-600 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Organisation Type
            </label>

            <select
              value={
                organizationType
              }
              onChange={(
                event
              ) =>
                setOrganizationType(
                  event.target.value
                )
              }
              className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500"
            >
              {organizationTypes.map(
                (
                  type
                ) => (
                  <option
                    key={
                      type
                    }
                    value={
                      type
                    }
                  >
                    {
                      type
                    }
                  </option>
                )
              )}
            </select>
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
              maxLength={
                1000
              }
              rows={
                4
              }
              placeholder="Describe the organisation and the communities it serves..."
              className="w-full resize-none rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none placeholder:text-gray-600 focus:border-blue-500"
            />

            <p className="mt-2 text-right text-xs text-gray-500">
              {
                description.length
              }
              /1000
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold">
                City
              </label>

              <input
                type="text"
                value={
                  city
                }
                onChange={(
                  event
                ) =>
                  setCity(
                    event.target.value
                  )
                }
                placeholder="Pretoria"
                className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none placeholder:text-gray-600 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Province
              </label>

              <input
                type="text"
                value={
                  province
                }
                onChange={(
                  event
                ) =>
                  setProvince(
                    event.target.value
                  )
                }
                placeholder="Gauteng"
                className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none placeholder:text-gray-600 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Country
            </label>

            <input
              type="text"
              value={
                country
              }
              onChange={(
                event
              ) =>
                setCountry(
                  event.target.value
                )
              }
              className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          <div className="rounded-xl border border-blue-900 bg-blue-950/20 p-5">
            <p className="font-semibold text-blue-300">
              🏢 Multi-tenant foundation
            </p>

            <p className="mt-2 text-sm leading-6 text-gray-400">
              Your admin account will become the owner of this organisation. In the next step, staff members and reports will be attached to it.
            </p>
          </div>

          <button
            type="submit"
            disabled={
              creating
            }
            className="w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating
              ? "Creating Organisation..."
              : "Create Organisation"}
          </button>
        </form>
      </div>
    </main>
  );
}