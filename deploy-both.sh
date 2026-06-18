#!/usr/bin/env bash
# Deploy the SAME current design to BOTH named Netlify sites, differing only by the background song.
#   bek-sofya-en  -> English song (the repo's committed music.mp3 = wed_mus, cut)
#   bek-sofya-kg  -> Kyrgyz song  (wed_mus2)
# Each gets its own canonical/og:url so link previews are correct per site.
# Run AFTER committing your build.py output (git archive HEAD is what ships).
set -e
cd "$(dirname "$0")"
KG_SONG="/Users/muhammed/Desktop/specs/wed_mus2_from10.mp3"   # Kyrgyz track (first 10s trimmed -> starts at 0:10) for the -kg site

deploy() {           # $1=siteID  $2=host  $3=song-file-to-use-as-music.mp3 (empty = keep repo's English)
  local SITE="$1" HOST="$2" SONG="$3"
  rm -rf /tmp/bsd && mkdir -p /tmp/bsd
  git archive HEAD | tar -x -C /tmp/bsd
  [ -n "$SONG" ] && cp "$SONG" /tmp/bsd/music.mp3
  for f in /tmp/bsd/index.html /tmp/bsd/kg.html /tmp/bsd/kz.html; do
    [ -f "$f" ] && sed -i '' "s/bek-and-sofya\.netlify\.app/$HOST/g" "$f"
  done
  echo "── deploying $HOST (song: ${SONG:-repo music.mp3 / English}) ──"
  npx --yes netlify-cli deploy --prod --dir /tmp/bsd --site "$SITE" 2>&1 | grep -E "Production URL|Unique deploy|Error|error" | head -3
}

deploy 1b5fd9d5-6aca-46c2-b599-cbc837db18bf bek-sofya-en.netlify.app ""          # English
deploy e7728afb-af36-4191-942e-391544440f5b bek-sofya-kg.netlify.app "$KG_SONG"  # Kyrgyz
echo "done"
