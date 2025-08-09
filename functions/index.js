/*
Copyright (C) 2025 <arcticfoxrc> <arcticfoxrc@gmail.com>

This program is free software; you can redistribute it and/or modify it
under the terms of the GNU General Public License as published by the
Free Software Foundation; version 3 of the License.

This program is distributed in the hope that it will be useful, but
WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details, or get a copy at
<https://www.gnu.org/licenses/gpl-3.0.txt>.
*/

/* eslint-disable no-undef */
// noinspection JSUnresolvedReference
// noinspection SpellCheckingInspection
// noinspection JSUnusedGlobalSymbols
// noinspection JDuplicatedCode

const {onRequest} = require("firebase-functions/v2/https");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
dayjs.extend(utc)
require("dotenv").config();

// Add these imports for Firebase Admin SDK

const admin = require("firebase-admin"); // Import the admin SDK
const {getFirestore} = require("firebase-admin/firestore"); // Import Firestore from admin SDK

// Initialize the Admin SDK
// When deployed to Cloud Functions, it automatically picks up credentials
// from the service account associated with the function.
admin.initializeApp();

// Get the Firestore instance from the Admin SDK
const db = getFirestore(); // No need to pass 'app' here


// --- Keep your existing onRequest functions ---
// For the 'onRequest' functions, the core logic of interacting with 'db'
// will now use the Admin SDK's capabilities.

const invalidResponse = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    500: "Internal Server Error"
}



// index.js
const { google } = require("googleapis");

/**
 * Cloud Function to enable Gmail push notifications for a user.
 * This function is designed to be triggered by an HTTP POST request.
 * It expects the user's access token and the Pub/Sub topic name in the request body.
 *
 * @param {object} req The HTTP request object.
 * @param {object} res The HTTP response object.
 */
exports.watchGmailMailbox = async (req, res) => {
    // Set CORS headers for all responses to allow requests from your React app
    res.set("Access-Control-Allow-Origin", "*"); // Consider restricting this to your React app's domain in production
    res.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Handle preflight OPTIONS request
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    // Ensure it's a POST request
    if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed. This function only accepts POST requests.");
    }

    const { accessToken, userId = "me" } = req.body; // userId defaults to 'me' for the authenticated user
    const topicName = process.env.GMAIL_PUBSUB_TOPIC; // Get topic name from environment variables

    if (!accessToken || !topicName) {
        return res.status(400).send("Missing accessToken or Pub/Sub topic name.");
    }

    try {
        // Authenticate with Gmail API using the provided access token
        const oAuth2Client = new google.auth.OAuth2();
        oAuth2Client.setCredentials({ access_token: accessToken });

        const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

        // Make the users.watch API call
        const response = await gmail.users.watch({
            userId: userId,
            requestBody: {
                topicName: topicName,
                labelIds: ["INBOX"], // You can specify other labels like ['INBOX', 'IMPORTANT']
                labelFilterBehavior: "INCLUDE" // Or 'EXCLUDE'
            }
        });

        console.log("Gmail watch request successful:", response.data);
        res.status(200).json({
            message: "Gmail push notifications enabled successfully.",
            historyId: response.data.historyId,
            expiration: response.data.expiration
        });

    } catch (error) {
        console.error("Error enabling Gmail push notifications:", error);

        // Provide a more detailed error message based on the error received
        if (error.code === 401 || error.code === 403) {
            res.status(error.code).send("Authentication or permission error: " + error.message);
        } else if (error.code === 400) {
            res.status(error.code).send("Bad Request: " + error.message);
        } else {
            res.status(500).send("Internal Server Error: " + error.message);
        }
    }
};


exports.addExpenseData = onRequest(async (req, res) => {

    const userEmail = process.env.USER_EMAIL;
    const validationStatus = await isValidRequest(req, userEmail);
    if (validationStatus !== 200) {
        res.status(validationStatus).send(invalidResponse[validationStatus]);
        return;
    }

    try {
        const expense = req.body;

        let key = dayjs(expense.date).utc().utcOffset(330)
            .format("DD MMM YY, hh:mm A") + " " + expense.vendor.slice(0, 10);

        const docRef = db.collection("expense").doc(key);

        // setDoc is now using the admin SDK's db instance
        docRef.set(expense).then(() => {
            console.log("Executed setDoc");
            res.send("Executed setDoc"); // Make sure to send response after async operation
        }).catch(err => {
            console.error("Error in addExpenseData setDoc:", err);
            res.status(500).send("Error - " + err.message);
        });

    } catch (err) {
        console.error("Error in addExpenseData:", err);
        res.status(500).send("Error - " + err.message);
    }

});


exports.getOneDoc = onRequest(async (req, res) => {

    const userEmail = process.env.USER_EMAIL;
    const validationStatus = await isValidRequest(req, userEmail);
    if (validationStatus !== 200) {
        res.status(validationStatus).send(invalidResponse[validationStatus]);
        return;
    }

    try {
        const data = req.body;

        const docRef = db.collection(data.collection).doc(data.key);
        docRef.get().then((resp) => {
            console.log(resp.data());
            res.send(resp.data());
        }).catch(err => {
            console.error("Error in getOneDoc getDoc:", err);
            res.status(500).send("Error - " + err.message);
        });

    } catch (err) {
        console.error("Error in getOneDoc:", err);
        res.status(500).send("Error - " + err.message);
    }

});


exports.setOneDoc = onRequest(async (req, res) => {

    const userEmail = process.env.USER_EMAIL;
    const validationStatus = await isValidRequest(req, userEmail);
    if (validationStatus !== 200) {
        res.status(validationStatus).send(invalidResponse[validationStatus]);
        return;
    }

    try {
        const data = req.body;

        const docRef = db.collection(data.collection).doc(data.key);
        docRef.set(data.json).then(() => {
            console.log("Executed setDoc");
            res.send("Executed setOneDoc"); // Make sure to send response after async operation
        }).catch(err => {
            console.error("Error in setOneDoc setDoc:", err);
            res.status(500).send("Error - " + err.message);
        });

    } catch (err) {
        console.error("Error in setOneDoc:", err);
        res.status(500).send("Error - " + err.message);
    }
});


exports.getAllDoc = onRequest(async (req, res) => {

    const userEmail = process.env.USER_EMAIL;
    const validationStatus = await isValidRequest(req, userEmail);
    if (validationStatus !== 200) {
        res.status(validationStatus).send(invalidResponse[validationStatus]);
        return;
    }

    try {
        const data = req.body;

        db.collection(data.collection).get().then((querySnapshot) => {
            let docList = [];
            querySnapshot.forEach((doc) => {
                let document = doc.data();
                document.id = doc.id;
                docList.push(document)
            });
            res.send(docList);
        }).catch(err => {
            console.error("Error in getAllDoc getDocs:", err);
            res.status(500).send("Error - " + err.message);
        });

    } catch (err) {
        console.error("Error in getAllDoc:", err);
        res.status(500).send("Error - " + err.message);
    }

});


const isValidRequest = async (req, userEmail) => {

    if (req.method !== "POST") {
        return 403;
    }

    if (!req.body || Object.keys(req.body).length === 0) {
        return 400;
    }

    if (!req.headers || !req.headers.authorization) {
        console.warn("No authorization header provided.");
        return 401;
    }

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {

        const token = req.headers.authorization.split("Bearer ")[1];

        try {
            // Verify the token against Google's token info endpoint
            const tokenInfoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${token}`);
            const tokenInfo = await tokenInfoResponse.json();

            console.log("token info", tokenInfo);

            if (tokenInfo.email_verified && tokenInfo.email === userEmail) {
                // console.log(`Service account ${userEmail} authenticated via OAuth2 access token.`);
                return 200;
            } else {
                console.warn(`OAuth2 token provided but email ${tokenInfo.email} is not matching account user email or not verified.`);
                return 401;
            }
        } catch (oauthError) {
            console.error("OAuth2 token verification failed:", oauthError.message);
            return 500;
        }
    }
}
