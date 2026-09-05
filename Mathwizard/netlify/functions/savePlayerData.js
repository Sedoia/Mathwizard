// netlify/functions/savePlayerData.js
const admin = require('firebase-admin');

// Initialize Firebase Admin (Using Environment Variables in Netlify)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    })
  });
}

const db = admin.firestore();

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const data = JSON.parse(event.body);
    const { uid, currency, unlockedLevels, guides } = data;

    await db.collection('players').doc(uid).set({
      currency,
      unlockedLevels,
      guides,
      lastSave: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { statusCode: 200, body: JSON.stringify({ message: "Success" }) };
  } catch (error) {
    return { statusCode: 500, body: error.toString() };
  }
};