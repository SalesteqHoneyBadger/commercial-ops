#!/bin/bash
# Commercial Ops QA Reviewer
# Watches for new draft entries and reviews each one using Claude Haiku
# Same pattern as HoneyBadger's reviewer.sh

DATA_DIR="/tmp/commercial-ops"
DRAFT_OUTREACH="$DATA_DIR/outreach-draft.jsonl"
APPROVED_OUTREACH="$DATA_DIR/outreach-approved.jsonl"
DRAFT_ASSETS="$DATA_DIR/assets.jsonl"
QA_LOG="$DATA_DIR/qa-reviews.jsonl"
QA_FEEDBACK="$DATA_DIR/qa-feedback.jsonl"
REVIEWED_TRACKER="$DATA_DIR/.qa-reviewed"
CLAUDE="/usr/local/bin/claude"
MODEL="haiku"

echo "╔═══════════════════════════════════════╗"
echo "║  QA Agent — Commercial Ops Reviewer   ║"
echo "║  Watching for drafts to review...     ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# Create files if missing
touch "$DRAFT_OUTREACH" "$DRAFT_ASSETS" "$QA_LOG" "$QA_FEEDBACK" "$REVIEWED_TRACKER" "$APPROVED_OUTREACH"

LAST_OUTREACH_COUNT=0
LAST_ASSETS_COUNT=0
LANDING_PAGE="/root/commercial-ops/landing/index.html"
LAST_LANDING_HASH=""

while true; do
  # Count current lines
  OUTREACH_COUNT=$(wc -l < "$DRAFT_OUTREACH" 2>/dev/null || echo 0)
  ASSETS_COUNT=$(wc -l < "$DRAFT_ASSETS" 2>/dev/null || echo 0)

  # Check for new outreach drafts
  if [ "$OUTREACH_COUNT" -gt "$LAST_OUTREACH_COUNT" ]; then
    # Process new lines
    NEW_START=$((LAST_OUTREACH_COUNT + 1))
    tail -n +"$NEW_START" "$DRAFT_OUTREACH" | while IFS= read -r LINE; do
      if [ -z "$LINE" ]; then continue; fi

      # Check if already reviewed
      LINE_HASH=$(echo "$LINE" | md5sum | cut -d' ' -f1)
      if grep -q "$LINE_HASH" "$REVIEWED_TRACKER" 2>/dev/null; then
        continue
      fi

      COMPANY=$(echo "$LINE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('company','unknown'))" 2>/dev/null)
      SUBJECT=$(echo "$LINE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('subject',''))" 2>/dev/null)
      BODY=$(echo "$LINE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('body',''))" 2>/dev/null)

      echo ""
      echo "═══════════════════════════════════════════════════"
      echo "[$(date '+%H:%M:%S')] 🔍 Reviewing outreach: $COMPANY"
      echo "  Subject: $SUBJECT"
      echo "═══════════════════════════════════════════════════"

      PROMPT="You are a QA reviewer for Salesteq commercial outreach.

Review this outreach email draft. Be CONCISE — max 5 bullet points.

Check for:
1. Does it reference the NAGHI Motors case study with accurate facts? (11+ brands, 250K vehicles/year, BMW/MINI exclusive dealer Saudi Arabia)
2. Is it personalized to the specific prospect (not generic)?
3. Tone: direct, confident, no buzzwords, no hedging?
4. Is there a clear CTA (book a 20-minute demo, link to automotive.salesteq.com)?
5. Spelling, grammar, professionalism?
6. Is the email 150-250 words (not too long, not too short)?
7. Cold outreach best practices: strong opening line, specific pain point, social proof (NAGHI), clear next step. No fluff.
8. Would a CEO of a European dealer group actually read this and reply?

Company: ${COMPANY}
Subject: ${SUBJECT}
Body:
${BODY}

Respond with:
- VERDICT: PASS or NEEDS_ATTENTION
- Bullet points of findings (if any)
- Keep it under 150 words total"

      REVIEW=$(echo "$PROMPT" | "$CLAUDE" -p --model "$MODEL" --no-session-persistence --max-budget-usd 0.05 2>/dev/null)
      REVIEW_EXIT=$?

      if [ $REVIEW_EXIT -ne 0 ] || [ -z "$REVIEW" ]; then
        echo "  ⚠  Review failed (exit $REVIEW_EXIT)"
        TS=$(date +%s)
        echo "{\"ts\":${TS},\"type\":\"outreach\",\"company\":\"${COMPANY}\",\"verdict\":\"ERROR\",\"review\":\"Review failed\"}" >> "$QA_LOG"
      else
        VERDICT="PASS"
        echo "$REVIEW" | grep -qi "NEEDS_ATTENTION" && VERDICT="NEEDS_ATTENTION"

        echo ""
        echo "$REVIEW"
        echo ""

        if [ "$VERDICT" = "PASS" ]; then
          echo "  ✅ PASS — $COMPANY"
          # Copy to approved
          echo "$LINE" >> "$APPROVED_OUTREACH"
        else
          echo "  ⚠️  NEEDS ATTENTION — $COMPANY"
          # Write feedback
          TS=$(date +%s)
          REVIEW_ESC=$(echo "$REVIEW" | tr '\n' '|' | sed 's/"/\\"/g' | head -c 1000)
          echo "{\"ts\":${TS},\"company\":\"${COMPANY}\",\"feedback\":\"${REVIEW_ESC}\"}" >> "$QA_FEEDBACK"
        fi

        TS=$(date +%s)
        REVIEW_ESC=$(echo "$REVIEW" | tr '\n' '|' | sed 's/"/\\"/g' | head -c 2000)
        echo "{\"ts\":${TS},\"type\":\"outreach\",\"company\":\"${COMPANY}\",\"subject\":\"${SUBJECT}\",\"verdict\":\"${VERDICT}\",\"review\":\"${REVIEW_ESC}\"}" >> "$QA_LOG"
      fi

      echo "$LINE_HASH" >> "$REVIEWED_TRACKER"
    done
    LAST_OUTREACH_COUNT=$OUTREACH_COUNT
  fi

  # Check for new asset drafts
  if [ "$ASSETS_COUNT" -gt "$LAST_ASSETS_COUNT" ]; then
    NEW_START=$((LAST_ASSETS_COUNT + 1))
    tail -n +"$NEW_START" "$DRAFT_ASSETS" | while IFS= read -r LINE; do
      if [ -z "$LINE" ]; then continue; fi

      LINE_HASH=$(echo "$LINE" | md5sum | cut -d' ' -f1)
      if grep -q "$LINE_HASH" "$REVIEWED_TRACKER" 2>/dev/null; then
        continue
      fi

      TITLE=$(echo "$LINE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('title','unknown'))" 2>/dev/null)
      TYPE=$(echo "$LINE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('type',''))" 2>/dev/null)
      CONTENT=$(echo "$LINE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('content','')[:500])" 2>/dev/null)

      echo ""
      echo "═══════════════════════════════════════════════════"
      echo "[$(date '+%H:%M:%S')] 🔍 Reviewing asset: $TITLE ($TYPE)"
      echo "═══════════════════════════════════════════════════"

      PROMPT="You are a QA reviewer for Salesteq marketing assets.

Review this marketing asset draft. Be CONCISE — max 5 bullet points.

Check for:
1. Does it reference the NAGHI Motors case study accurately?
2. Is the content professional and compelling?
3. Tone: direct, confident, no buzzwords?
4. Factual accuracy (Salesteq products, NAGHI details)?
5. Would this work for the stated purpose (${TYPE})?

Title: ${TITLE}
Type: ${TYPE}
Content (first 500 chars):
${CONTENT}

Respond with:
- VERDICT: PASS or NEEDS_ATTENTION
- Bullet points of findings
- Keep it under 100 words"

      REVIEW=$(echo "$PROMPT" | "$CLAUDE" -p --model "$MODEL" --no-session-persistence --max-budget-usd 0.05 2>/dev/null)
      REVIEW_EXIT=$?

      if [ $REVIEW_EXIT -ne 0 ] || [ -z "$REVIEW" ]; then
        echo "  ⚠  Review failed"
      else
        VERDICT="PASS"
        echo "$REVIEW" | grep -qi "NEEDS_ATTENTION" && VERDICT="NEEDS_ATTENTION"

        echo ""
        echo "$REVIEW"
        echo ""

        if [ "$VERDICT" = "PASS" ]; then
          echo "  ✅ PASS — $TITLE"
        else
          echo "  ⚠️  NEEDS ATTENTION — $TITLE"
        fi

        TS=$(date +%s)
        REVIEW_ESC=$(echo "$REVIEW" | tr '\n' '|' | sed 's/"/\\"/g' | head -c 2000)
        echo "{\"ts\":${TS},\"type\":\"asset\",\"title\":\"${TITLE}\",\"assetType\":\"${TYPE}\",\"verdict\":\"${VERDICT}\",\"review\":\"${REVIEW_ESC}\"}" >> "$QA_LOG"
      fi

      echo "$LINE_HASH" >> "$REVIEWED_TRACKER"
    done
    LAST_ASSETS_COUNT=$ASSETS_COUNT
  fi

  # Check if landing page changed
  if [ -f "$LANDING_PAGE" ]; then
    LANDING_HASH=$(md5sum "$LANDING_PAGE" 2>/dev/null | cut -d' ' -f1)
    if [ "$LANDING_HASH" != "$LAST_LANDING_HASH" ]; then
      LAST_LANDING_HASH="$LANDING_HASH"

      echo ""
      echo "═══════════════════════════════════════════════════"
      echo "[$(date '+%H:%M:%S')] Reviewing landing page: automotive.salesteq.com/landing/"
      echo "═══════════════════════════════════════════════════"

      LANDING_CONTENT=$(head -c 2000 "$LANDING_PAGE")

      PROMPT="You are a QA reviewer for the Salesteq automotive landing page at automotive.salesteq.com/landing/.

Review this landing page HTML. Be CONCISE — max 5 bullet points.

Check for:
1. Does it reference NAGHI Motors accurately? (11+ brands, 250K vehicles/year, BMW exclusive dealer Saudi Arabia)
2. Is it professional and compelling for European automotive dealer group executives?
3. Clear value proposition and CTA (book a demo)?
4. No buzzwords, no typos, proper formatting?
5. Does it represent Salesteq products correctly?

HTML (first 2000 chars):
${LANDING_CONTENT}

Respond with:
- VERDICT: PASS or NEEDS_ATTENTION
- Bullet points of findings
- Keep it under 150 words"

      REVIEW=$(echo "$PROMPT" | "$CLAUDE" -p --model "$MODEL" --no-session-persistence --max-budget-usd 0.05 2>/dev/null)

      if [ -n "$REVIEW" ]; then
        VERDICT="PASS"
        echo "$REVIEW" | grep -qi "NEEDS_ATTENTION" && VERDICT="NEEDS_ATTENTION"

        echo ""
        echo "$REVIEW"
        echo ""

        if [ "$VERDICT" = "PASS" ]; then
          echo "  PASS — Landing page"
        else
          echo "  NEEDS ATTENTION — Landing page"
        fi

        TS=$(date +%s)
        REVIEW_ESC=$(echo "$REVIEW" | tr '\n' '|' | sed 's/"/\\"/g' | head -c 2000)
        echo "{\"ts\":${TS},\"type\":\"landing-page\",\"company\":\"automotive.salesteq.com\",\"verdict\":\"${VERDICT}\",\"review\":\"${REVIEW_ESC}\"}" >> "$QA_LOG"
      fi
    fi
  fi

  sleep 5
done
