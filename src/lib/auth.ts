import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";

import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "./firebase";

export async function registerUser(
  name: string,
  email: string,
  password: string
) {
  const userCredential =
    await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

  const user = userCredential.user;

  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    name: name,
    email: email,
    role: "resident",
    trustScore: 50,
    createdAt: serverTimestamp(),
  });

  return user;
}

export async function loginUser(
  email: string,
  password: string
) {
  const userCredential =
    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

  return userCredential.user;
}