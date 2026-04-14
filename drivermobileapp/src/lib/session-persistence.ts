// src/lib/session-persistence.ts
import type { UserMetadata } from '@supabase/supabase-js';

/** Lightweight session shape stored in IndexedDB / localStorage backup */
export interface SessionBackup {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
    expires_in?: number;
    user?: {
        id: string;
        email?: string;
        user_metadata: UserMetadata;
    };
}

const DB_NAME = 'mata-session-db';
const STORE_NAME = 'sessions';
const DB_VERSION = 1;

async function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

export async function persistSessionToIndexedDB(session: SessionBackup) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(session, 'current-session');

        // Also keep in localStorage as backup
        localStorage.setItem('mata-driver-session-backup', JSON.stringify(session));
    } catch (error) {
        console.error('Failed to persist session to IndexedDB:', error);
    }
}

export async function loadSessionFromIndexedDB(): Promise<SessionBackup | null> {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get('current-session');

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Failed to load session from IndexedDB:', error);

        // Fallback to localStorage
        const backup = localStorage.getItem('mata-driver-session-backup');
        return backup ? JSON.parse(backup) : null;
    }
}

export async function clearSessionFromIndexedDB() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete('current-session');
        localStorage.removeItem('mata-driver-session-backup');
    } catch (error) {
        console.error('Failed to clear session from IndexedDB:', error);
    }
}