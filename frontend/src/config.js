import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// datos Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBcOOIDjee9ELV7LQk-ad_SP_jMc55hxac",
  authDomain: "tiktok-clon-146a4.firebaseapp.com",
  projectId: "tiktok-clon-146a4",
  storageBucket: "tiktok-clon-146a4.firebasestorage.app",
  messagingSenderId: "469732326288",
  appId: "1:469732326288:web:13c5b6b0cdc2e76a295115"
};

// Inicia Firebase con esos datos
const app = initializeApp(firebaseConfig);

// auth sirve para registro e inicio de sesion
export const auth = getAuth(app);

// db sirve para guardar y leer datos (usuarios, videos, likes, comentarios,)
export const db = getFirestore(app);