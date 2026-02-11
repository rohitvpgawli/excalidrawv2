import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    query,
    orderBy,
    getDoc,
    setDoc,
} from "firebase/firestore";
import { getFirestore } from "../data/firebase";

export interface Page {
    id: string;
    name?: string; // Changed from title to match UserDrawing
    elements: any[];
    appState: any;
    createdAt: any;
    updatedAt: any;
}

// Helper to get firestore instance (assuming it's initialized in data/firebase.ts)
// We might need to export the accessor from there if it's not already
// unique wrapper to ensure we get the instance
const getDB = () => {
    // @ts-ignore
    return getFirestore();
};

export const createPage = async (userId: string, name: string = "Untitled Page") => {
    const db = getDB();
    try {
        const pagesRef = collection(db, "users", userId, "drawings");
        const docRef = await addDoc(pagesRef, {
            name,
            elements: [],
            appState: {},
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            userId,
        });
        return { id: docRef.id, name, createdAt: new Date() };
    } catch (e) {
        console.error("Error adding document: ", e);
        throw e;
    }
};

export const getPages = async (userId: string): Promise<Page[]> => {
    const db = getDB();
    try {
        const q = query(
            collection(db, "users", userId, "drawings"),
            orderBy("updatedAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as Page[];
    } catch (e) {
        console.error("Error fetching pages: ", e);
        return [];
    }
};

export const getPage = async (userId: string, pageId: string): Promise<Page | null> => {
    const db = getDB();
    try {
        const docRef = doc(db, "users", userId, "drawings", pageId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Page;
        } else {
            console.log("No such document!");
            return null;
        }
    } catch (e) {
        console.error("Error getting page:", e);
        throw e;
    }
}

export const updatePage = async (
    userId: string,
    pageId: string,
    data: Partial<Page>
) => {
    const db = getDB();
    try {
        const docRef = doc(db, "users", userId, "drawings", pageId);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp(),
        });
    } catch (e) {
        console.error("Error updating page: ", e);
        throw e;
    }
};

export const deletePage = async (userId: string, pageId: string) => {
    const db = getDB();
    try {
        await deleteDoc(doc(db, "users", userId, "drawings", pageId));
    } catch (e) {
        console.error("Error deleting page: ", e);
        throw e;
    }
};
