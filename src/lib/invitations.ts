/**
 * Organisation invitations service for CivicPulse.
 * Handles invite creation, email validation, cancellation, and secure acceptance
 * with multi-tenant isolation and account hijacking prevention.
 */

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";
import { createAuditLog } from "@/src/lib/auditLog";
import { createNotification } from "@/src/lib/notifications";
import type {
  OrganizationInvite,
  OrganizationRole,
  UserProfile,
  UserRole,
} from "@/src/lib/types";

export interface CreateInviteInput {
  organizationId: string;
  organizationName: string;
  email: string;
  targetRole: "admin" | "staff" | "member";
  invitedBy: string;
  invitedByName: string;
  invitedByRole: string;
}

/**
 * Creates an invitation to an organisation for an email address.
 * Prevents inviting members already in an organisation or duplicate pending invites.
 */
export async function createOrganizationInvite({
  organizationId,
  organizationName,
  email,
  targetRole,
  invitedBy,
  invitedByName,
  invitedByRole,
}: CreateInviteInput): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new Error("A valid email address is required.");
  }

  // 1. Check for an existing pending invitation in this organisation
  const pendingQuery = query(
    collection(db, "organizationInvites"),
    where("organizationId", "==", organizationId),
    where("email", "==", normalizedEmail),
    where("status", "==", "pending")
  );
  const pendingSnapshot = await getDocs(pendingQuery);
  if (!pendingSnapshot.empty) {
    throw new Error("A pending invitation already exists for this email.");
  }

  // 2. Check if a registered user with this email already belongs to an organisation
  const userQuery = query(
    collection(db, "users"),
    where("email", "==", normalizedEmail)
  );
  const userSnapshot = await getDocs(userQuery);

  let existingTargetUid: string | null = null;
  if (!userSnapshot.empty) {
    const existingUserDoc = userSnapshot.docs[0];
    const existingUserData = existingUserDoc.data() as UserProfile;
    existingTargetUid = existingUserDoc.id;

    if (existingUserData.organizationId === organizationId) {
      throw new Error("This user is already a member of your organisation.");
    }
    if (existingUserData.organizationId) {
      throw new Error(
        "This user already belongs to another organisation. They must leave that organisation first."
      );
    }
  }

  // Map roles
  let role: UserRole = "resident";
  let organizationRole: OrganizationRole = "member";

  if (targetRole === "admin") {
    role = "admin";
    organizationRole = "admin";
  } else if (targetRole === "staff") {
    role = "staff";
    organizationRole = "staff";
  } else {
    role = "resident";
    organizationRole = "member";
  }

  // Expiration: 14 days from now
  const expiresAtDate = new Date();
  expiresAtDate.setDate(expiresAtDate.getDate() + 14);
  const expiresAt = Timestamp.fromDate(expiresAtDate);

  const inviteData = {
    organizationId,
    organizationName,
    email: normalizedEmail,
    role,
    organizationRole,
    status: "pending",
    invitedBy,
    invitedByName,
    createdAt: serverTimestamp(),
    expiresAt,
    acceptedAt: null,
    acceptedBy: null,
  };

  const inviteRef = await addDoc(
    collection(db, "organizationInvites"),
    inviteData
  );

  // Audit log
  await createAuditLog({
    organizationId,
    action: "invite_created",
    entityType: "organization_invite",
    entityId: inviteRef.id,
    performedBy: invitedBy,
    performedByName: invitedByName,
    performedByRole: invitedByRole,
    metadata: {
      email: normalizedEmail,
      targetRole,
      role,
      organizationRole,
    },
  });

  // If the user already has an account, send them an in-app notification
  if (existingTargetUid) {
    await createNotification({
      userId: existingTargetUid,
      createdBy: invitedBy,
      type: "invite",
      title: "Organisation Invitation",
      message: `You have been invited to join ${organizationName} as ${targetRole}.`,
      organizationId,
    });
  }

  return inviteRef.id;
}

/**
 * Cancels a pending invitation.
 */
export async function cancelOrganizationInvite(
  inviteId: string,
  organizationId: string,
  cancelledBy: string,
  cancelledByName: string,
  cancelledByRole: string
): Promise<void> {
  const inviteRef = doc(db, "organizationInvites", inviteId);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) {
    throw new Error("Invitation not found.");
  }

  const inviteData = inviteSnap.data() as OrganizationInvite;

  // Tenant check
  if (inviteData.organizationId !== organizationId) {
    throw new Error("Permission denied: invitation belongs to another organisation.");
  }

  if (inviteData.status !== "pending") {
    throw new Error(`Cannot cancel an invitation that is already ${inviteData.status}.`);
  }

  await updateDoc(inviteRef, {
    status: "cancelled",
    cancelledAt: serverTimestamp(),
    cancelledBy,
  });

  await createAuditLog({
    organizationId,
    action: "invite_cancelled",
    entityType: "organization_invite",
    entityId: inviteId,
    performedBy: cancelledBy,
    performedByName: cancelledByName,
    performedByRole: cancelledByRole,
    metadata: {
      email: inviteData.email,
    },
  });
}

/**
 * Secures invite acceptance:
 * - Checks user authenticated email against invite email
 * - Checks that status is 'pending' and not expired
 * - Prevents cross-organisation account hijacking if user already belongs to another org
 * - Updates user profile role and organization membership
 * - Updates invite to 'accepted' and updates org memberCount
 */
export async function acceptOrganizationInvite(
  inviteId: string,
  currentUser: { uid: string; email: string; name?: string },
  currentProfile: UserProfile | null
): Promise<{ organizationId: string; organizationName: string }> {
  if (!currentUser.email) {
    throw new Error("Authenticated email address is required.");
  }

  const userEmail = currentUser.email.trim().toLowerCase();

  const inviteRef = doc(db, "organizationInvites", inviteId);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) {
    throw new Error("Invitation does not exist or has been removed.");
  }

  const invite = inviteSnap.data() as OrganizationInvite;

  // 1. Email match check
  if (invite.email.trim().toLowerCase() !== userEmail) {
    throw new Error(
      `This invitation was sent to ${invite.email}. Your current account email is ${currentUser.email}.`
    );
  }

  // 2. Status check
  if (invite.status !== "pending") {
    throw new Error(`This invitation is no longer valid (status: ${invite.status}).`);
  }

  // 3. Expiration check
  if (invite.expiresAt) {
    const expiresDate =
      invite.expiresAt instanceof Date
        ? invite.expiresAt
        : (invite.expiresAt as Timestamp).toDate();
    if (expiresDate.getTime() < Date.now()) {
      await updateDoc(inviteRef, { status: "expired" });
      throw new Error("This invitation has expired.");
    }
  }

  // 4. Cross-organisation account hijacking prevention
  if (
    currentProfile?.organizationId &&
    currentProfile.organizationId !== invite.organizationId
  ) {
    throw new Error(
      `You are currently a member of "${currentProfile.organizationName || "another organisation"}". ` +
        "You must leave your current organisation before accepting a new invitation."
    );
  }

  // 5. Update user profile
  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, {
    organizationId: invite.organizationId,
    organizationName: invite.organizationName,
    role: invite.role,
    organizationRole: invite.organizationRole,
    organizationJoinedAt: serverTimestamp(),
  });

  // 6. Update invite record
  await updateDoc(inviteRef, {
    status: "accepted",
    acceptedAt: serverTimestamp(),
    acceptedBy: currentUser.uid,
  });

  // 7. Increment organisation member count
  try {
    const orgRef = doc(db, "organizations", invite.organizationId);
    await updateDoc(orgRef, {
      memberCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (orgErr) {
    console.warn("Failed to increment member count:", orgErr);
  }

  // 8. Audit log
  await createAuditLog({
    organizationId: invite.organizationId,
    action: "invite_accepted",
    entityType: "organization_invite",
    entityId: inviteId,
    performedBy: currentUser.uid,
    performedByName: currentUser.name || currentUser.email,
    performedByRole: invite.role,
    metadata: {
      email: invite.email,
      role: invite.role,
      organizationRole: invite.organizationRole,
    },
  });

  // 9. Notify the admin who sent the invite
  if (invite.invitedBy) {
    await createNotification({
      userId: invite.invitedBy,
      createdBy: currentUser.uid,
      type: "invite",
      title: "Invitation Accepted",
      message: `${currentUser.name || currentUser.email} accepted the invitation to join ${invite.organizationName}.`,
      organizationId: invite.organizationId,
    });
  }

  return {
    organizationId: invite.organizationId,
    organizationName: invite.organizationName,
  };
}

/**
 * Declines an invitation.
 */
export async function declineOrganizationInvite(
  inviteId: string,
  userEmail: string
): Promise<void> {
  const normalizedEmail = userEmail.trim().toLowerCase();
  const inviteRef = doc(db, "organizationInvites", inviteId);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) {
    throw new Error("Invitation not found.");
  }

  const invite = inviteSnap.data() as OrganizationInvite;

  if (invite.email.trim().toLowerCase() !== normalizedEmail) {
    throw new Error("Permission denied: email does not match invitation.");
  }

  if (invite.status !== "pending") {
    throw new Error(`Invitation is already ${invite.status}.`);
  }

  await updateDoc(inviteRef, {
    status: "cancelled",
  });
}
