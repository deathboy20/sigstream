import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDkH3rGQ0UoH2a_fNFO7HaP2oOpazyH7rU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "fieldcom-8159b.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "fieldcom-8159b",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "fieldcom-8159b.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "548978360911",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:548978360911:web:0e05e3d0220d623edc203a",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-MN9QG97XJE",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
