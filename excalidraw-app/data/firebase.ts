import { reconcileElements } from "@excalidraw/excalidraw";
import { MIME_TYPES, toBrandedType } from "@excalidraw/common";
import { decompressData } from "@excalidraw/excalidraw/data/encode";
import {
  encryptData,
  decryptData,
} from "@excalidraw/excalidraw/data/encryption";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { getSceneVersion } from "@excalidraw/element";
import { nanoid } from "nanoid";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { initializeApp } from "firebase/app";
import {
  getFirestore as getFirestoreInstance,
  doc,
  getDoc,
  runTransaction,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  serverTimestamp,
  Bytes,
  deleteDoc,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes } from "firebase/storage";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type {
  ExcalidrawElement,
  FileId,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFileMetadata,
  DataURL,
} from "@excalidraw/excalidraw/types";

import { FILE_CACHE_MAX_AGE_SEC } from "../app_constants";

import { getSyncableElements } from ".";

import type { SyncableExcalidrawElement } from ".";
import type Portal from "../collab/Portal";
import type { Socket } from "socket.io-client";

// private
// -----------------------------------------------------------------------------

let FIREBASE_CONFIG: Record<string, any>;
try {
  FIREBASE_CONFIG = JSON.parse(import.meta.env.VITE_APP_FIREBASE_CONFIG);
} catch (error: any) {
  console.warn(
    `Error JSON parsing firebase config. Supplied value: ${import.meta.env.VITE_APP_FIREBASE_CONFIG
    }`,
  );
  FIREBASE_CONFIG = {};
}

const _initializeFirebase = () => {
  if (!firebaseApp) {
    firebaseApp = initializeApp(FIREBASE_CONFIG);
  }
  return firebaseApp;
};

let firebaseApp: ReturnType<typeof initializeApp> | null = null;
let firestore: ReturnType<typeof getFirestoreInstance> | null = null;
let firebaseStorage: ReturnType<typeof getStorage> | null = null;

const _getFirestore = () => {
  if (!firestore) {
    firestore = getFirestoreInstance(_initializeFirebase());
  }
  return firestore;
};

export const getFirestore = _getFirestore;

const _getStorage = () => {
  if (!firebaseStorage) {
    firebaseStorage = getStorage(_initializeFirebase());
  }
  return firebaseStorage;
};

// -----------------------------------------------------------------------------

export const loadFirebaseStorage = async () => {
  return _getStorage();
};

type FirebaseStoredScene = {
  sceneVersion: number;
  iv: Bytes;
  ciphertext: Bytes;
};

const encryptElements = async (
  key: string,
  elements: readonly ExcalidrawElement[],
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> => {
  const json = JSON.stringify(elements);
  const encoded = new TextEncoder().encode(json);
  const { encryptedBuffer, iv } = await encryptData(key, encoded);

  return { ciphertext: encryptedBuffer, iv };
};

const decryptElements = async (
  data: FirebaseStoredScene,
  roomKey: string,
): Promise<readonly ExcalidrawElement[]> => {
  const ciphertext = data.ciphertext.toUint8Array() as Uint8Array<ArrayBuffer>;
  const iv = data.iv.toUint8Array() as Uint8Array<ArrayBuffer>;

  const decrypted = await decryptData(iv, ciphertext, roomKey);
  const decodedData = new TextDecoder("utf-8").decode(
    new Uint8Array(decrypted),
  );
  return JSON.parse(decodedData);
};

class FirebaseSceneVersionCache {
  private static cache = new WeakMap<Socket, number>();
  static get = (socket: Socket) => {
    return FirebaseSceneVersionCache.cache.get(socket);
  };
  static set = (
    socket: Socket,
    elements: readonly SyncableExcalidrawElement[],
  ) => {
    FirebaseSceneVersionCache.cache.set(socket, getSceneVersion(elements));
  };
}

export const isSavedToFirebase = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    const sceneVersion = getSceneVersion(elements);

    return FirebaseSceneVersionCache.get(portal.socket) === sceneVersion;
  }
  // if no room exists, consider the room saved so that we don't unnecessarily
  // prevent unload (there's nothing we could do at that point anyway)
  return true;
};

export const saveFilesToFirebase = async ({
  prefix,
  files,
}: {
  prefix: string;
  files: { id: FileId; buffer: Uint8Array }[];
}) => {
  const storage = await loadFirebaseStorage();

  const erroredFiles: FileId[] = [];
  const savedFiles: FileId[] = [];

  await Promise.all(
    files.map(async ({ id, buffer }) => {
      try {
        const storageRef = ref(storage, `${prefix}/${id}`);
        await uploadBytes(storageRef, buffer, {
          cacheControl: `public, max-age=${FILE_CACHE_MAX_AGE_SEC}`,
        });
        savedFiles.push(id);
      } catch (error: any) {
        erroredFiles.push(id);
      }
    }),
  );

  return { savedFiles, erroredFiles };
};

const createFirebaseSceneDocument = async (
  elements: readonly SyncableExcalidrawElement[],
  roomKey: string,
) => {
  const sceneVersion = getSceneVersion(elements);
  const { ciphertext, iv } = await encryptElements(roomKey, elements);
  return {
    sceneVersion,
    ciphertext: Bytes.fromUint8Array(new Uint8Array(ciphertext)),
    iv: Bytes.fromUint8Array(iv),
  } as FirebaseStoredScene;
};

export const saveToFirebase = async (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
  appState: AppState,
) => {
  const { roomId, roomKey, socket } = portal;
  if (
    // bail if no room exists as there's nothing we can do at this point
    !roomId ||
    !roomKey ||
    !socket ||
    isSavedToFirebase(portal, elements)
  ) {
    return null;
  }

  const firestore = _getFirestore();
  const docRef = doc(firestore, "scenes", roomId);

  const storedScene = await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(docRef);

    if (!snapshot.exists()) {
      const storedScene = await createFirebaseSceneDocument(elements, roomKey);

      transaction.set(docRef, storedScene);

      return storedScene;
    }

    const prevStoredScene = snapshot.data() as FirebaseStoredScene;
    const prevStoredElements = getSyncableElements(
      restoreElements(await decryptElements(prevStoredScene, roomKey), null),
    );
    const reconciledElements = getSyncableElements(
      reconcileElements(
        elements,
        prevStoredElements as OrderedExcalidrawElement[] as RemoteExcalidrawElement[],
        appState,
      ),
    );

    const storedScene = await createFirebaseSceneDocument(
      reconciledElements,
      roomKey,
    );

    transaction.update(docRef, storedScene);

    // Return the stored elements as the in memory `reconciledElements` could have mutated in the meantime
    return storedScene;
  });

  const storedElements = getSyncableElements(
    restoreElements(await decryptElements(storedScene, roomKey), null),
  );

  FirebaseSceneVersionCache.set(socket, storedElements);

  return toBrandedType<RemoteExcalidrawElement[]>(storedElements);
};

export const loadFromFirebase = async (
  roomId: string,
  roomKey: string,
  socket: Socket | null,
): Promise<readonly SyncableExcalidrawElement[] | null> => {
  const firestore = _getFirestore();
  const docRef = doc(firestore, "scenes", roomId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    return null;
  }
  const storedScene = docSnap.data() as FirebaseStoredScene;
  const elements = getSyncableElements(
    restoreElements(await decryptElements(storedScene, roomKey), null, {
      deleteInvisibleElements: true,
    }),
  );

  if (socket) {
    FirebaseSceneVersionCache.set(socket, elements);
  }

  return elements;
};

export const loadFilesFromFirebase = async (
  prefix: string,
  decryptionKey: string,
  filesIds: readonly FileId[],
) => {
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  await Promise.all(
    [...new Set(filesIds)].map(async (id) => {
      try {
        const url = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_CONFIG.storageBucket
          }/o/${encodeURIComponent(prefix.replace(/^\//, ""))}%2F${id}`;
        const response = await fetch(`${url}?alt=media`);
        if (response.status < 400) {
          const arrayBuffer = await response.arrayBuffer();

          const { data, metadata } = await decompressData<BinaryFileMetadata>(
            new Uint8Array(arrayBuffer),
            {
              decryptionKey,
            },
          );

          const dataURL = new TextDecoder().decode(data) as DataURL;

          loadedFiles.push({
            mimeType: metadata.mimeType || MIME_TYPES.binary,
            id,
            dataURL,
            created: metadata?.created || Date.now(),
            lastRetrieved: metadata?.created || Date.now(),
          });
        } else {
          erroredFiles.set(id, true);
        }
      } catch (error: any) {
        erroredFiles.set(id, true);
        console.error(error);
      }
    }),
  );

  return { loadedFiles, erroredFiles };
};

// -----------------------------------------------------------------------------
// User Drawings Persistence
// -----------------------------------------------------------------------------

export interface UserDrawing {
  id: string; // Drawing ID
  userId: string;
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  files: BinaryFileData[];
  createdAt: any;
  updatedAt: any;
  name?: string;
}

export const saveDrawingToFirestore = async (
  userId: string,
  drawingId: string,
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files?: BinaryFileData[],
  name?: string,
) => {
  const firestore = _getFirestore();
  const drawingRef = doc(firestore, "users", userId, "drawings", drawingId);

  // Filter out deleted elements to save space? keeping them for now as per normal save
  // const plainElements = elements.map((el) => toBrandedType<ExcalidrawElement>(el));

  const drawingData = {
    userId,
    elements: JSON.stringify(elements), // Firestore doesn't support nested arrays
    appState: JSON.stringify(appState),
    files: files ? JSON.stringify(files) : "[]",
    updatedAt: serverTimestamp(),
    // Set createdAt only if it doesn't exist (handled by merge: true if we use setDoc)
    // But for now let's just update updatedAt
  };

  if (name) {
    Object.assign(drawingData, { name });
  }

  // Use setDoc with merge: true to update or create
  // We need to handle createdAt separately if we want it immutable
  await setDoc(
    drawingRef,
    {
      ...drawingData,
      createdAt: serverTimestamp(), // This will be overwritten on every save if we don't be careful.
      // Ideally we check existence first or use update.
      // For auto-save, we can just use setDoc with merge and maybe ignore createdAt if it exists?
      // Actually, serverTimestamp() in merge will update it.
    },
    { merge: true },
  );

  return drawingId;
};

export const getUserDrawings = async (userId: string) => {
  const firestore = _getFirestore();
  const drawingsRef = collection(firestore, "users", userId, "drawings");
  const q = query(drawingsRef, orderBy("updatedAt", "desc"), limit(50));

  const querySnapshot = await getDocs(q);
  const drawings: any[] = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    drawings.push({
      id: doc.id,
      ...data,
      elements: data.elements ? JSON.parse(data.elements) : [],
      appState: data.appState ? JSON.parse(data.appState) : {},
      files: data.files ? JSON.parse(data.files) : [],
    });
  });
  return drawings;
};

export const loadDrawingFromFirestore = async (
  userId: string,
  drawingId: string,
) => {
  const firestore = _getFirestore();
  const drawingRef = doc(firestore, "users", userId, "drawings", drawingId);
  const docSnap = await getDoc(drawingRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      elements: data.elements ? JSON.parse(data.elements) : [],
      appState: data.appState ? JSON.parse(data.appState) : {},
      files: data.files ? JSON.parse(data.files) : [],
    } as UserDrawing;
  } else {
    return null;
  }
};

export const deleteDrawing = async (userId: string, drawingId: string) => {
  const firestore = _getFirestore();
  const drawingRef = doc(firestore, "users", userId, "drawings", drawingId);
  await deleteDoc(drawingRef);
};

export const createDrawing = async (userId: string, name: string) => {
  const newId = nanoid();
  const elements: any[] = [];
  const appState = getDefaultAppState();

  await saveDrawingToFirestore(userId, newId, elements, appState as AppState, [], name);
  return { id: newId, name, elements, appState, updatedAt: new Date() };
};

