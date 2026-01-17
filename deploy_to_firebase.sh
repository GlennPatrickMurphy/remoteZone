#!/bin/bash
# Deploy Flask Server to Google Cloud Run (Firebase)

set -e

echo "🚀 Deploying Flask Server to Google Cloud Run..."
echo ""

# Check if authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "⚠️  Not authenticated. Running gcloud auth login..."
    echo "📝 Please complete authentication in your browser."
    gcloud auth login
fi

# Set project
echo "📋 Setting project to remotezone-c717d..."
gcloud config set project remotezone-c717d

# Enable APIs
echo "🔧 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com --quiet
gcloud services enable run.googleapis.com --quiet
gcloud services enable containerregistry.googleapis.com --quiet

echo ""
echo "🏗️  Building and deploying to Cloud Run..."
echo "   This may take 5-10 minutes on first deployment..."
echo ""

# Deploy to Cloud Run
# Cloud Run will auto-detect Dockerfile if present, otherwise use source-based build
gcloud run deploy nfl-redzone-server \
  --source . \
  --clear-base-image \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10 \
  --project remotezone-c717d

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📡 Your server URL:"
gcloud run services describe nfl-redzone-server \
  --region us-central1 \
  --format="value(status.url)"

echo ""
echo "🔗 Next steps:"
echo "1. Copy the URL above"
echo "2. Update mobile-app/src/config/api.js with the Cloud Run URL"
echo "3. Test the deployment!"
