/**
 * Firebase Admin SDK singleton (SERVER ONLY).
 *
 * The Admin SDK bypasses Firestore security rules, so it is the only way the
 * app reads/writes data. NEVER import this from a Client Component.
 *
 * Credentials resolution order:
 *   1. FIREBASE_SERVICE_ACCOUNT  — full JSON string (CI / App Hosting secret)
 *   2. GOOGLE_APPLICATION_CREDENTIALS — path to JSON (local dev) / ADC
 */
import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

const projectId =
  process.env.GCP_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  "cheer-overview-site";

function initAdmin(): App {
  const existing = getApps();
  if (existing.length) return existing[0];

  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (inlineJson) {
    const parsed = JSON.parse(inlineJson);
    return initializeApp({ credential: cert(parsed), projectId });
  }
  // Falls back to GOOGLE_APPLICATION_CREDENTIALS / ADC.
  return initializeApp({ projectId });
}

const app = initAdmin();

export const adminDb: Firestore = getFirestore(app);
export const adminAuth: Auth = getAuth(app);
