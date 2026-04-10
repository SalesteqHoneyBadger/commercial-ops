#!/bin/bash
# Send styled test email with PDF one-pager to viktor@salesteq.com
# Usage: bash send-test-email.sh '{"company":"Emil Frey","to":"ceo@emilfrey.ch","subject":"...","body":"...",...}'
# The email ALWAYS goes to viktor@salesteq.com regardless of the "to" field.

SPARKPOST_API_KEY="48c01a30fba324bc86324bfe13e624fe9e4d8225"
FROM_EMAIL="viktor@salesteq.com"
FROM_NAME="Viktor Andreas"
TEST_TO="viktor@salesteq.com"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

EMAIL_JSON="$1"
if [ -z "$EMAIL_JSON" ]; then
  echo "Usage: bash send-test-email.sh '{\"company\":\"...\",\"subject\":\"...\",\"body\":\"...\"}'"
  exit 1
fi

# Extract fields
COMPANY=$(echo "$EMAIL_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin).get('company',''))")
ORIGINAL_TO=$(echo "$EMAIL_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin).get('to',''))")
SUBJECT=$(echo "$EMAIL_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin).get('subject',''))")
BODY=$(echo "$EMAIL_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin).get('body',''))")

echo "Preparing email for: $COMPANY"
echo "  Original to: $ORIGINAL_TO"
echo "  Test to: $TEST_TO"
echo "  Subject: $SUBJECT"

# Generate PDF one-pager for this prospect
PDF_PATH="/tmp/onepager-$(echo "$COMPANY" | tr ' ' '-' | tr '[:upper:]' '[:lower:]').pdf"

# Find prospect data
PROSPECT_JSON=$(python3 -c "
import json
company = '$COMPANY'
with open('/tmp/commercial-ops/prospects.jsonl') as f:
    for line in f:
        d = json.loads(line.strip())
        if d.get('company','').lower() == company.lower():
            print(json.dumps(d))
            break
    else:
        print(json.dumps({'company': company}))
")

echo "  Generating PDF one-pager..."
python3 "$REPO_DIR/generate-onepager.py" "$PROSPECT_JSON" "$PDF_PATH" 2>/dev/null

if [ ! -f "$PDF_PATH" ]; then
  echo "  Warning: PDF generation failed, sending without attachment"
  PDF_B64=""
else
  PDF_B64=$(base64 -w 0 "$PDF_PATH")
  echo "  PDF ready: $(du -h "$PDF_PATH" | cut -f1)"
fi

# Build styled HTML email
BODY_HTML=$(python3 -c "
import sys, json

body = '''$BODY'''
lines = body.strip().split('\n')
body_html = ''
for line in lines:
    line = line.strip()
    if not line:
        body_html += '<br/>'
    else:
        body_html += f'<p style=\"margin:0 0 12px 0;\">{line}</p>'

print(body_html)
")

HTML_EMAIL=$(python3 -c "
import json, sys

body_html = sys.stdin.read()
company = '$COMPANY'
original_to = '$ORIGINAL_TO'

html = '''<!DOCTYPE html>
<html><head><meta charset=\"UTF-8\"/></head>
<body style=\"margin:0;padding:0;background:#f5f5f5;font-family:Helvetica,Arial,sans-serif;\">
<div style=\"max-width:600px;margin:0 auto;padding:32px 0;\">

  <!-- Test banner -->
  <div style=\"background:#fff3cd;color:#856404;padding:10px 24px;font-size:12px;border-radius:8px 8px 0 0;text-align:center;\">
    TEST EMAIL — Original recipient: ''' + original_to + '''
  </div>

  <!-- Main card -->
  <div style=\"background:#ffffff;padding:40px 36px;border-radius:0 0 8px 8px;box-shadow:0 2px 8px rgba(0,0,0,0.06);\">

    <!-- Body -->
    <div style=\"font-size:15px;line-height:1.7;color:#333;\">
''' + body_html + '''
    </div>

    <!-- Signature -->
    <div style=\"margin-top:28px;padding-top:20px;border-top:1px solid #eee;\">
      <div style=\"font-size:14px;font-weight:600;color:#1a1a1a;\">Viktor Andreas</div>
      <div style=\"font-size:13px;color:#888;margin-top:2px;\">Founder &middot; Salesteq</div>
      <div style=\"font-size:13px;color:#888;\">Elyon GmbH &middot; Zug, Switzerland</div>
      <div style=\"margin-top:8px;\">
        <a href=\"https://automotive.salesteq.com\" style=\"font-size:13px;color:#e8720c;text-decoration:none;font-weight:500;\">automotive.salesteq.com</a>
        <span style=\"color:#ccc;margin:0 8px;\">|</span>
        <a href=\"mailto:viktor@salesteq.com\" style=\"font-size:13px;color:#e8720c;text-decoration:none;\">viktor@salesteq.com</a>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div style=\"text-align:center;padding:16px;font-size:11px;color:#aaa;\">
    Salesteq &middot; AI Commercial Operations
  </div>

</div>
</body></html>'''

print(html)
" <<< "$BODY_HTML")

# Build SparkPost payload with attachment
PAYLOAD=$(python3 -c "
import json, sys, base64

html = sys.stdin.read()
pdf_b64 = '$PDF_B64'
company = '$COMPANY'

payload = {
    'recipients': [{'address': {'email': '$TEST_TO'}}],
    'content': {
        'from': {'email': '$FROM_EMAIL', 'name': '$FROM_NAME'},
        'subject': '$SUBJECT',
        'html': html,
        'attachments': []
    }
}

if pdf_b64:
    payload['content']['attachments'].append({
        'name': f'Salesteq-{company.replace(\" \",\"-\")}-OnePager.pdf',
        'type': 'application/pdf',
        'data': pdf_b64
    })

print(json.dumps(payload))
" <<< "$HTML_EMAIL")

echo "  Sending..."
RESPONSE=$(curl -s -X POST \
  "https://api.eu.sparkpost.com/api/v1/transmissions" \
  -H "Authorization: ${SPARKPOST_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

if echo "$RESPONSE" | grep -q '"total_accepted_recipients":1'; then
  echo "  Sent to $TEST_TO (test mode)"
  echo ""
else
  echo "  Failed: $RESPONSE"
  echo ""
fi
