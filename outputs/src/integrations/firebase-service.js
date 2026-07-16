import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { getFirestore, addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getStorage, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { firebaseConfig, appCheckSiteKey } from './firebase-config.js';

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

export const enableAppCheck = () => initializeAppCheck(firebaseApp, {
  provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
  isTokenAutoRefreshEnabled: true
});

export const authApi = {
  observe: (callback) => onAuthStateChanged(auth, callback),
  registerParent: (email, password) => createUserWithEmailAndPassword(auth, email, password),
  signInParent: (email, password) => signInWithEmailAndPassword(auth, email, password),
  sendPasswordReset: (email) => sendPasswordResetEmail(auth, email),
  signOut: () => signOut(auth)
};

export const familyApi = {
  createFamily: async ({ ownerUid, child }) => {
    const familyRef = await addDoc(collection(db, 'families'), {
      ownerUid,
      createdAt: serverTimestamp(),
      childCount: 1
    });
    await setDoc(doc(db, 'families', familyRef.id, 'children', child.id), {
      ...child,
      createdAt: serverTimestamp()
    });
    return familyRef.id;
  },

  saveChildProfile: (familyId, childId, child) => setDoc(doc(db, 'families', familyId, 'children', childId), {
    ...child,
    updatedAt: serverTimestamp()
  }, { merge: true }),

  loadFamily: async (familyId) => {
    const snapshot = await getDoc(doc(db, 'families', familyId));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  },

  uploadMissionPhoto: async ({ familyId, missionId, uid, file }) => {
    const storagePath = `families/${familyId}/submissions/${missionId}/${uid}.jpg`;
    const fileRef = ref(storage, storagePath);
    await uploadBytes(fileRef, file, { contentType: file.type || 'image/jpeg' });
    return { storagePath, downloadUrl: await getDownloadURL(fileRef) };
  },

  saveMissionSubmission: (familyId, missionId, submission) => setDoc(doc(db, 'families', familyId, 'submissions', missionId), {
    ...submission,
    updatedAt: serverTimestamp()
  }, { merge: true }),

  approveReward: (familyId, levelId, reward) => setDoc(doc(db, 'families', familyId, 'rewards', levelId), {
    ...reward,
    approvedAt: serverTimestamp()
  }, { merge: true })
};
