POST_DIR=$1
MD_FILE=$POST_DIR/output.md
HTML_FILE=$POST_DIR/index.html
CSS_FILE=/assets/github-markdown.css

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
