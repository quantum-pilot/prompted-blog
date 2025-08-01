CSS_FILE=/assets/github-markdown.css
LATEST_POST=""
ALL_POSTS=()

for POST_DIR in posts/*/; do
  [ -d "$POST_DIR" ] || continue
  [ ! -d "$POST_DIR/diff_cache" ] && continue
  MD_FILE="$POST_DIR/output.md"
  HTML_FILE="$POST_DIR/index.html"
  echo $POST_DIR
  # [ -f "$MD_FILE" ] || continue

  BODY=$(docker run --rm -v "$PWD":/data pandoc/core:3.1 \
    -f markdown -t html5 "/data/$MD_FILE")

  {
    echo "<!DOCTYPE html>"
    echo "<html><head>"
    echo "<meta charset='utf-8'>"
    echo "<link rel='stylesheet' href='$CSS_FILE'>"
    echo "</head><body><article class='markdown-body'>"
    echo "$BODY"
    echo "</article></body></html>"
  } > "$HTML_FILE"

  LATEST_POST="$POST_DIR"
  ALL_POSTS+=("${POST_DIR%/}")

done

if [ -n "$LATEST_POST" ]; then
  echo "\"${LATEST_POST%/}\"" > latest.json
fi

# Generate posts.json with all posts
if [ ${#ALL_POSTS[@]} -gt 0 ]; then
  printf '%s\n' "${ALL_POSTS[@]}" | jq -R . | jq -s . > posts.json
fi
