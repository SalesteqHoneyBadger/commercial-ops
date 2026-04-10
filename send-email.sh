#!/bin/bash
# Send email via SparkPost EU API
# Usage: bash send-email.sh "to@email.com" "Subject" "Body text or HTML"
# From: viktor@salesteq.com

SPARKPOST_API_KEY="48c01a30fba324bc86324bfe13e624fe9e4d8225"
FROM_EMAIL="viktor@salesteq.com"
FROM_NAME="Viktor Andreas"

TO="$1"
SUBJECT="$2"
BODY="$3"

if [ -z "$TO" ] || [ -z "$SUBJECT" ] || [ -z "$BODY" ]; then
  echo "Usage: bash send-email.sh \"to@email.com\" \"Subject\" \"Body\""
  exit 1
fi

# Escape JSON special characters in body
BODY_ESC=$(echo "$BODY" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read())[1:-1])")

RESPONSE=$(curl -s -X POST \
  "https://api.eu.sparkpost.com/api/v1/transmissions" \
  -H "Authorization: ${SPARKPOST_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"recipients\": [{\"address\": {\"email\": \"${TO}\"}}],
    \"content\": {
      \"from\": {\"email\": \"${FROM_EMAIL}\", \"name\": \"${FROM_NAME}\"},
      \"subject\": \"${SUBJECT}\",
      \"html\": \"${BODY_ESC}\"
    }
  }")

echo "$RESPONSE"

# Check if successful
if echo "$RESPONSE" | grep -q '"total_accepted_recipients":1'; then
  echo ""
  echo "✅ Email sent to ${TO}"
else
  echo ""
  echo "❌ Failed to send email"
fi
