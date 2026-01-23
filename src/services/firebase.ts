import { initializeApp } from "firebase/app";

// We only need the app initialization for now if we use Auth later.
// Realtime Database is NOT used.
const firebaseConfig = {
  apiKey: "AIzaSyDzXEFEPR5Qw6ZHUB7s7q_AS65P3qntQCM",
  authDomain: "stream-6c5bb.firebaseapp.com",
  projectId: "stream-6c5bb",
  storageBucket: "stream-6c5bb.firebasestorage.app",
  messagingSenderId: "934572124832",
  appId: "1:934572124832:web:ff543b81acf179155c77c5",
  measurementId: "G-MB0XJ68B98",

};

export const app = initializeApp(firebaseConfig);
// export const db = getDatabase(app); // DISABLED: Using Socket.IO + In-Memory Backend
