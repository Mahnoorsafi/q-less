// Firebase Functions placeholder for future backend integration.
// This file is intentionally minimal so you can plug in actual functions later.

const functions = require('firebase-functions');

exports.helloWorld = functions.https.onRequest((request, response) => {
  response.send('QMe Firebase Functions are ready.');
});
