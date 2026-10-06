import type { Database } from "../domain/types";
import { SCHEMA_VERSION } from "../domain/types";

/**
 * 本地优先存储。唯一持久层是 IndexedDB —— 没有账号、没有远端、没有缓存服务器。
 * 手写封装而不引 `idb`：整个文件不到 100 行，少一个供应链项，行为完全可审计。
 */

const DB_NAME = "openreboot";
const STORE = "state";
const KEY = "db";

export interface KvStore {
  get(): Promise<Database | null>;
  put(db: Database): Promise<void>;
  clear(): Promise<void>;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexeddb open failed"));
    req.onblocked = () => reject(new Error("indexeddb blocked"));
  });
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result as T);
    r.onerror = () => reject(r.error ?? new Error("indexeddb request failed"));
  });
}

export function idbStore(): KvStore {
  if (typeof indexedDB === "undefined") return memoryStore();
  return {
    async get() {
      const db = await openDb();
      try {
        const v = await tx<Database | undefined>(db, "readonly", (s) => s.get(KEY));
        return v ?? null;
      } finally {
        db.close();
      }
    },
    async put(value) {
      const db = await openDb();
      try {
        await tx(db, "readwrite", (s) => s.put(value, KEY));
      } finally {
        db.close();
      }
    },
    async clear() {
      const db = await openDb();
      try {
        await tx(db, "readwrite", (s) => s.delete(KEY));
      } finally {
        db.close();
      }
    },
  };
}

/** 测试与无 IDB 环境（如 SSR 预渲染）用的替身，行为与上面一致。 */
export function memoryStore(initial: Database | null = null): KvStore & { peek(): Database | null } {
  let v: Database | null = initial;
  return {
    async get() {
      return v ? (structuredClone(v) as Database) : null;
    },
    async put(next) {
      v = structuredClone(next) as Database;
    },
    async clear() {
      v = null;
    },
    peek: () => v,
  };
}

export function emptyDatabase(now: string): Database {
  return {
    profile: { schemaVersion: SCHEMA_VERSION, createdAt: now, updatedAt: now, readiness: null },
    changes: [],
  };
}
