#!/bin/bash

# --- Automated Pub/Sub Setup for PennyFox ---

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
# Get the Firebase Project ID from .firebaserc
FIREBASE_PROJECT_ID=$(cat .firebaserc | grep "default" | awk -F'"' '{print $4}')
# Define a name for your Pub/Sub topic
GMAIL_TOPIC_NAME="pennyfox-gmail-notifications"
# The service account that needs publish permissions
GMAIL_API_SERVICE_ACCOUNT="gmail-api-push@system.gserviceaccount.com"

echo "Using Firebase Project ID: $FIREBASE_PROJECT_ID"
echo "Creating Pub/Sub topic: $GMAIL_TOPIC_NAME"
echo "---"

# 1. Check if gcloud is installed and authenticated
if ! command -v gcloud &> /dev/null
then
    echo "gcloud command not found. Please install the Google Cloud SDK and authenticate."
    exit 1
fi

echo "Authenticating with gcloud..."
gcloud auth list
echo "If the account above is not the correct one, please run 'gcloud auth login' and try again."

# 2. Create the Pub/Sub topic
echo "Creating Cloud Pub/Sub topic..."
gcloud pubsub topics create "$GMAIL_TOPIC_NAME" --project="$FIREBASE_PROJECT_ID"

# 3. Grant publish permissions to the Gmail API service account
echo "Granting 'Pub/Sub Publisher' role to the Gmail API service account..."
gcloud pubsub topics add-iam-policy-binding "$GMAIL_TOPIC_NAME" \
    --project="$FIREBASE_PROJECT_ID" \
    --member="serviceAccount:$GMAIL_API_SERVICE_ACCOUNT" \
    --role="roles/pubsub.publisher"

echo "---"
echo "Pub/Sub topic '$GMAIL_TOPIC_NAME' has been created and permissions granted."
echo "You can now proceed with deploying the Firebase Function."
