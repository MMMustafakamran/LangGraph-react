#!/bin/bash
# HARNESS: grid.sh <video.webm> <out.png> [cols] [rows] — evenly spaced frames tiled into one image.
v="$1"; out="$2"; c=${3:-4}; r=${4:-4}
d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$v" | cut -d. -f1); n=$((c*r))
ffmpeg -v error -y -i "$v" -vf "fps=$n/$d,scale=480:-1,tile=${c}x${r}" -frames:v 1 "$out" && echo "$d s -> $out"
