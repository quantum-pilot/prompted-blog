POST_DIR=$1
MD_FILE=$POST_DIR/output.md
HTML_FILE=$POST_DIR/index.html

wget https://raw.githubusercontent.com/sindresorhus/github-markdown-css/main/github-markdown.css -O github-markdown.css

# Mount local CSS via absolute path
docker build -t md-render engine/
docker run --rm \
  -v "$PWD":/data \
  md-render \
  pandoc "/data/$MD_FILE" -f markdown -t html5 \
  --css=/data/assets/github-markdown.css \
  -s -o "/data/$HTML_FILE"
