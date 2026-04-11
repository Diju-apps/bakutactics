import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCay6OyD46e55beIDMhQEfA52s4hFKeqDg",
  authDomain: "bakutactics-d4dd5.firebaseapp.com",
  projectId: "bakutactics-d4dd5",
  storageBucket: "bakutactics-d4dd5.firebasestorage.app",
  messagingSenderId: "645834778063",
  appId: "1:645834778063:web:687119a02412c6b502deba"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
