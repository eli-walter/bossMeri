import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: "elizabeth-market.firebaseapp.com",
  projectId: "elizabeth-market",
  storageBucket: "elizabeth-market.firebasestorage.app",
  messagingSenderId: "574099195465",
  appId: "1:574099195465:web:19cbee43a9af30e7652198"
};

const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
