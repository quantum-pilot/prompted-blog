POST_DIR=$1
MD_FILE=$POST_DIR/output.md
HTML_FILE=$POST_DIR/index.html
CSS_FILE=assets/github-markdown.css

docker run --rm -v "$PWD":/data pandoc/core:3.1 \
  pandoc "/data/$MD_FILE" -f markdown -t html5 \
  --css="/data/$CSS_FILE" \
  -s -o "/data/$HTML_FILE"
