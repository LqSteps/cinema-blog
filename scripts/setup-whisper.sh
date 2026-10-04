#!/usr/bin/env bash
# Creates the Python environment used by `npm run transcribe` (git-ignored).
# The Whisper model itself (~1.6 GB) downloads on the first transcription,
# into the Hugging Face cache (~/.cache/huggingface).
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -m venv .venv-whisper
.venv-whisper/bin/pip install --quiet --upgrade pip
.venv-whisper/bin/pip install --quiet faster-whisper numpy
echo "Whisper environment ready: npm run transcribe -- <slug> [options]"
