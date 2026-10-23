import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
    apiKey: "AIzaSyAzynN0WHoA02GezlFchDy8uqJ9kWiZM38",
    authDomain: "sonaris-b1b96.firebaseapp.com",
    databaseURL: "https://sonaris-b1b96-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "sonaris-b1b96",
    storageBucket: "sonaris-b1b96.firebasestorage.app",
    messagingSenderId: "82618066990",
    appId: "1:82618066990:web:98c82cc04b5a96213c17bf"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);