#!/bin/bash
WKDIR=$(dirname "$(readlink -f "$0")")/..
PHOTOS_DIR="$WKDIR/photos"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$PHOTOS_DIR"

sudo fswebcam -d /dev/video0 -r 2500x1900 -S 2 -F 2 "$PHOTOS_DIR/${TIMESTAMP}_upper.jpg"
sudo fswebcam -d /dev/video2 -r 2500x1900 -S 2 -F 2 "$PHOTOS_DIR/${TIMESTAMP}_lower.jpg"

# Update /tmp symlinks so any existing consumers still work
ln -sf "$PHOTOS_DIR/${TIMESTAMP}_upper.jpg" /tmp/upper_cam.jpg
ln -sf "$PHOTOS_DIR/${TIMESTAMP}_lower.jpg" /tmp/lower_cam.jpg

# Size-based pruning: keep photos/ dir under 10 GB, deleting oldest first
LIMIT_BYTES=$((10 * 1024 * 1024 * 1024))
while [ "$(du -sb "$PHOTOS_DIR" | cut -f1)" -gt "$LIMIT_BYTES" ]; do
  OLDEST=$(ls -t "$PHOTOS_DIR"/*.jpg 2>/dev/null | tail -1)
  [ -z "$OLDEST" ] && break
  rm -f "$OLDEST"
done

# update pass if you wish to manually trigger mqtt publish
#mosquitto_pub -t "gardyn/image/upper_cam" -f /tmp/upper_cam.jpg -u gardyn -P <password>
#mosquitto_pub -t "gardyn/image/lower_cam" -f /tmp/lower_cam.jpg -u gardyn -P <password>
