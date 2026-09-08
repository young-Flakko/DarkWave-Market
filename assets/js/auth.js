import { auth, db } from './firebase-config.js';

import {
  onAuthStateChanged
} from 'firebase/auth';

import {
  doc,
  getDoc
} from 'firebase/firestore';


// ============================================================
// GET CURRENT FIREBASE AUTH USER
// ============================================================

export function getCurrentUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}


// ============================================================
// GET USER PROFILE FROM FIRESTORE
// /users/{uid}
// ============================================================

export async function getUserProfile(uid) {
  if (!uid) return null;

  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return null;
  }

  return {
    id: snap.id,
    ...snap.data()
  };
}


// ============================================================
// GET CURRENT USER + FIRESTORE PROFILE
// ============================================================

export async function getCurrentUserWithProfile() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      profile: null
    };
  }

  const profile = await getUserProfile(user.uid);

  return {
    user,
    profile
  };
}


// ============================================================
// BASIC AUTH GUARD
// ============================================================

export function requireAuth(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = '/login.html';
      return;
    }

    const profile = await getUserProfile(user.uid);

    if (callback) {
      callback(user, profile);
    }
  });
}


// ============================================================
// ADMIN GUARD
// ============================================================

export function requireAdmin(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = '/login.html';
      return;
    }

    const profile = await getUserProfile(user.uid);

    if (!profile || profile.role !== 'admin') {
      window.location.href = '/account.html';
      return;
    }

    if (callback) {
      callback(user, profile);
    }
  });
}


// ============================================================
// RESELLER GUARD
// ============================================================

export function requireReseller(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = '/login.html';
      return;
    }

    const profile = await getUserProfile(user.uid);

    if (
      !profile ||
      !['reseller', 'admin'].includes(profile.role)
    ) {
      window.location.href = '/account.html';
      return;
    }

    if (callback) {
      callback(user, profile);
    }
  });
}


// ============================================================
// ROLE HELPERS
// ============================================================

export function isAdminProfile(profile) {
  return !!profile && profile.role === 'admin';
}

export function isResellerProfile(profile) {
  return !!profile &&
    ['reseller', 'admin'].includes(profile.role);
}

export function isCustomerProfile(profile) {
  return !!profile && profile.role === 'customer';
}