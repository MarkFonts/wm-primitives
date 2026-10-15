#!/bin/sh
# tools/hdr/build.sh <target> [--ship-avif] [--lossless-report]   e.g.  tools/hdr/build.sh q5-light
# Needs numpy (a venv: PYTHON=.venv/bin/python), cjxl (brew install jpeg-xl), and for the AVIF fallback
# tools/accent/out/pq_write (swiftc -O tools/accent/pq_write.swift -o tools/accent/out/pq_write) and sips (macOS).
# The capture (tools/accent/out/cap.npz) must exist: tools/accent/capture.py, then `capture.py broad`.
cd "$(dirname "$0")" && exec "${PYTHON:-python3}" build.py "$@"
