import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDhD7INyZquRyOb655UDFJ6smoXHxXGyNo",
  authDomain: "darkwave-market.firebaseapp.com",
  projectId: "darkwave-market",
  storageBucket: "darkwave-market.firebasestorage.app",
  messagingSenderId: "326855139322",
  appId: "1:326855139322:web:ece0abd19e2300f31f4e43",
  measurementId: "G-7D7FXLP7WJ"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
