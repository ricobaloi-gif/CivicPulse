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
  collection,
  doc,
  getDoc,
  getDocs,
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
  uid: string;
  name?: string;
  email?: string;
  role?: string;

  organizationId?: string | null;
  organizationName?: string | null;
  organizationRole?: string | null;
};

type Organization = {
  id: string;
  name: string;
  type?: string;
  description?: string;
  city?: string;
  province?: string;
  country?: string;
  ownerId: string;
  status?: string;
};

function getDisplayName(
  user: UserProfile
) {
  return (
    user.name?.trim() ||
    user.email ||
    "Unnamed User"
  );
}

function getRoleLabel(
  role?: string
) {
  switch (
    role
      ?.toLowerCase()
      .trim()
  ) {
    case "admin":
      return "Admin";

    case "staff":
      return "Staff";

    default:
      return "Resident";
  }
}

function getRoleClasses(
  role?: string
) {
  switch (
    role
      ?.toLowerCase()
      .trim()
  ) {
    case "admin":
      return "border-blue-800 bg-blue-950/40 text-blue-300";

    case "staff":
      return "border-indigo-800 bg-indigo-950/40 text-indigo-300";

    default:
      return "border-gray-700 bg-gray-800 text-gray-300";
  }
}

function getOrganizationRole(
  user: UserProfile
) {
  const role =
    user.role
      ?.toLowerCase()
      .trim();

  if (
    role === "admin"
  ) {
    return "manager";
  }

  if (
    role === "staff"
  ) {
    return "staff";
  }

  return "member";
}

export default function OrganizationManagePage() {
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
    organization,
    setOrganization,
  ] =
    useState<Organization | null>(
      null
    );

  const [
    users,
    setUsers,
  ] =
    useState<UserProfile[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    updatingUserId,
    setUpdatingUserId,
  ] =
    useState<string | null>(
      null
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

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

  async function loadEverything() {
    if (!user) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const currentUserRef =
        doc(
          db,
          "users",
          user.uid
        );

      const currentUserSnapshot =
        await getDoc(
          currentUserRef
        );

      if (
        !currentUserSnapshot.exists()
      ) {
        setError(
          "Your CivicPulse profile could not be found."
        );

        return;
      }

      const currentProfile =
        currentUserSnapshot.data() as UserProfile;

      setProfile(
        currentProfile
      );

      const role =
        currentProfile.role
          ?.toLowerCase()
          .trim();

      if (
        role !== "admin"
      ) {
        return;
      }

      if (
        !currentProfile.organizationId
      ) {
        return;
      }

      const organizationRef =
        doc(
          db,
          "organizations",
          currentProfile.organizationId
        );

      const organizationSnapshot =
        await getDoc(
          organizationRef
        );

      if (
        !organizationSnapshot.exists()
      ) {
        setError(
          "Your organisation could not be found."
        );

        return;
      }

      setOrganization({
        id:
          organizationSnapshot.id,

        ...organizationSnapshot.data(),
      } as Organization);

      const usersSnapshot =
        await getDocs(
          collection(
            db,
            "users"
          )
        );

      const allUsers =
        usersSnapshot.docs.map(
          (
            userDoc
          ) => ({
            uid:
              userDoc.id,

            ...userDoc.data(),
          })
        ) as UserProfile[];

      allUsers.sort(
        (
          a,
          b
        ) =>
          getDisplayName(
            a
          ).localeCompare(
            getDisplayName(
              b
            )
          )
      );

      setUsers(
        allUsers
      );
    } catch (err) {
      console.error(
        "Organisation management load error:",
        err
      );

      setError(
        "Unable to load organisation management."
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

    loadEverything();
  }, [
    user,
    authLoading,
  ]);

  async function handleAddMember(
    member: UserProfile
  ) {
    if (
      !user ||
      !profile ||
      !organization
    ) {
      return;
    }

    try {
      setUpdatingUserId(
        member.uid
      );

      setError("");
      setSuccess("");

      const memberRef =
        doc(
          db,
          "users",
          member.uid
        );

      await updateDoc(
        memberRef,
        {
          organizationId:
            organization.id,

          organizationName:
            organization.name,

          organizationRole:
            getOrganizationRole(
              member
            ),

          organizationJoinedAt:
            serverTimestamp(),
        }
      );

      setSuccess(
        `${getDisplayName(
          member
        )} was added to ${organization.name}.`
      );

      await loadEverything();
    } catch (err) {
      console.error(
        "Add organisation member error:",
        err
      );

      setError(
        "Failed to add this user to the organisation."
      );
    } finally {
      setUpdatingUserId(
        null
      );
    }
  }

  async function handleRemoveMember(
    member: UserProfile
  ) {
    if (
      !user ||
      !organization
    ) {
      return;
    }

    if (
      member.uid ===
      organization.ownerId
    ) {
      setError(
        "The organisation owner cannot be removed."
      );

      return;
    }

    try {
      setUpdatingUserId(
        member.uid
      );

      setError("");
      setSuccess("");

      const memberRef =
        doc(
          db,
          "users",
          member.uid
        );

      await updateDoc(
        memberRef,
        {
          organizationId:
            null,

          organizationName:
            null,

          organizationRole:
            null,

          organizationJoinedAt:
            null,
        }
      );

      setSuccess(
        `${getDisplayName(
          member
        )} was removed from ${organization.name}.`
      );

      await loadEverything();
    } catch (err) {
      console.error(
        "Remove organisation member error:",
        err
      );

      setError(
        "Failed to remove this user from the organisation."
      );
    } finally {
      setUpdatingUserId(
        null
      );
    }
  }

  const organizationMembers =
    useMemo(
      () => {
        if (
          !organization
        ) {
          return [];
        }

        return users.filter(
          (
            member
          ) =>
            member.organizationId ===
            organization.id
        );
      },
      [
        users,
        organization,
      ]
    );

  const availableUsers =
    useMemo(
      () => {
        if (
          !organization
        ) {
          return [];
        }

        const normalizedSearch =
          search
            .trim()
            .toLowerCase();

        return users.filter(
          (
            candidate
          ) => {
            if (
              candidate.organizationId
            ) {
              return false;
            }

            if (
              candidate.uid ===
              user?.uid
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
                candidate.name,
                candidate.email,
                candidate.role,
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
        users,
        organization,
        search,
        user,
      ]
    );

  if (
    authLoading ||
    loading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />

          <p className="mt-4 text-gray-400">
            Loading organisation...
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

  if (
    role !== "admin"
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 p-6 text-white">
        <div className="w-full max-w-lg rounded-2xl border border-red-900 bg-gray-900 p-8 text-center">
          <div className="text-5xl">
            🔒
          </div>

          <h1 className="mt-5 text-3xl font-bold">
            Access Denied
          </h1>

          <p className="mt-3 text-gray-400">
            Only administrators can manage CivicPulse organisations.
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
            Dashboard
          </button>
        </div>
      </main>
    );
  }

  if (
    !profile?.organizationId
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 p-6 text-white">
        <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
          <div className="text-5xl">
            🏢
          </div>

          <h1 className="mt-5 text-3xl font-bold">
            No Organisation
          </h1>

          <p className="mt-3 text-gray-400">
            Create an organisation before managing members.
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/organization/setup"
              )
            }
            className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
          >
            Create Organisation
          </button>
        </div>
      </main>
    );
  }

  if (!organization) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 p-6 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            Organisation unavailable
          </h1>

          <p className="mt-3 text-gray-400">
            {error ||
              "The organisation could not be loaded."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-6xl p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
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

          <button
            type="button"
            onClick={() =>
              router.push(
                "/admin"
              )
            }
            className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm font-semibold hover:bg-gray-800"
          >
            Operations
          </button>
        </div>

        <header className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
            Organisation Management
          </p>

          <h1 className="mt-3 text-4xl font-bold">
            {
              organization.name
            }
          </h1>

          <p className="mt-3 text-gray-400">
            Manage the CivicPulse accounts that belong to this organisation.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {organization.type && (
              <span className="rounded-full border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-300">
                {
                  organization.type
                }
              </span>
            )}

            {organization.city && (
              <span className="rounded-full border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-300">
                📍{" "}
                {
                  organization.city
                }
              </span>
            )}

            <span className="rounded-full border border-green-900 bg-green-950/30 px-4 py-2 text-sm font-semibold text-green-300">
              {
                organizationMembers.length
              }{" "}
              Member
              {organizationMembers.length ===
              1
                ? ""
                : "s"}
            </span>
          </div>
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

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-indigo-400">
                Current Team
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                Organisation Members
              </h2>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {organizationMembers.length ===
            0 ? (
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center text-gray-400">
                No members found.
              </div>
            ) : (
              organizationMembers.map(
                (
                  member
                ) => {
                  const isOwner =
                    member.uid ===
                    organization.ownerId;

                  return (
                    <div
                      key={
                        member.uid
                      }
                      className="flex flex-col gap-4 rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-lg font-bold">
                            {getDisplayName(
                              member
                            )}
                          </p>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getRoleClasses(
                              member.role
                            )}`}
                          >
                            {getRoleLabel(
                              member.role
                            )}
                          </span>

                          {isOwner && (
                            <span className="rounded-full border border-yellow-800 bg-yellow-950/30 px-2.5 py-1 text-xs font-semibold text-yellow-300">
                              Owner
                            </span>
                          )}
                        </div>

                        {member.email && (
                          <p className="mt-1 text-sm text-gray-500">
                            {
                              member.email
                            }
                          </p>
                        )}

                        <p className="mt-2 text-xs uppercase tracking-wider text-gray-500">
                          Organisation role:{" "}
                          {member.organizationRole ||
                            "member"}
                        </p>
                      </div>

                      {!isOwner && (
                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveMember(
                              member
                            )
                          }
                          disabled={
                            updatingUserId ===
                            member.uid
                          }
                          className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-950 disabled:opacity-50"
                        >
                          {updatingUserId ===
                          member.uid
                            ? "Removing..."
                            : "Remove"}
                        </button>
                      )}
                    </div>
                  );
                }
              )
            )}
          </div>
        </section>

        <section className="mt-12">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-green-400">
              Add People
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              Available CivicPulse Users
            </h2>

            <p className="mt-2 text-sm text-gray-400">
              These accounts do not currently belong to an organisation.
            </p>
          </div>

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
            placeholder="Search by name, email or role..."
            className="mt-5 w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 outline-none placeholder:text-gray-600 focus:border-blue-500"
          />

          <div className="mt-5 space-y-3">
            {availableUsers.length ===
            0 ? (
              <div className="rounded-xl border border-dashed border-gray-700 p-8 text-center">
                <div className="text-4xl">
                  👥
                </div>

                <p className="mt-4 font-semibold">
                  No available users
                </p>

                <p className="mt-2 text-sm text-gray-500">
                  New CivicPulse accounts will appear here once they register.
                </p>
              </div>
            ) : (
              availableUsers.map(
                (
                  candidate
                ) => (
                  <div
                    key={
                      candidate.uid
                    }
                    className="flex flex-col gap-4 rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-lg font-bold">
                          {getDisplayName(
                            candidate
                          )}
                        </p>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getRoleClasses(
                            candidate.role
                          )}`}
                        >
                          {getRoleLabel(
                            candidate.role
                          )}
                        </span>
                      </div>

                      {candidate.email && (
                        <p className="mt-1 text-sm text-gray-500">
                          {
                            candidate.email
                          }
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleAddMember(
                          candidate
                        )
                      }
                      disabled={
                        updatingUserId ===
                        candidate.uid
                      }
                      className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold hover:bg-blue-500 disabled:opacity-50"
                    >
                      {updatingUserId ===
                      candidate.uid
                        ? "Adding..."
                        : "Add to Organisation"}
                    </button>
                  </div>
                )
              )
            )}
          </div>
        </section>
      </div>
    </main>
  );
}