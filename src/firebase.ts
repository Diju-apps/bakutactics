import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDd6QpF-OVMetetP_84agLdy8YJJBchMwI",
    authDomain: "tacticasbloxugan.firebaseapp.com",
    projectId: "tacticasbloxugan",
    storageBucket: "tacticasbloxugan.firebasestorage.app",
    messagingSenderId: "28253441172",
    appId: "1:28253441172:web:8917955517a41278c2f881"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
