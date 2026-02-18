#!/bin/bash

# Jeeliz Library Downloader for Apotheca AR Plugin
# Run this script to download all required Jeeliz files

echo "=================================="
echo "Jeeliz Library Downloader"
echo "=================================="
echo ""

# Create directories
echo "Creating directories..."
mkdir -p assets/lib/NNC

# Download main library
echo "Downloading Jeeliz WebAR Makeup library..."
curl -L "https://cdn.jsdelivr.net/npm/jeelizwebarmakeup@1.0.6/dist/jeelizWebARMakeup.min.js" -o "assets/lib/jeelizWebARMakeup.min.js"

# Download NNC files
echo "Downloading NNC files..."
curl -L "https://cdn.jsdelivr.net/npm/jeelizwebarmakeup@1.0.6/dist/NNC.json" -o "assets/lib/NNC/NNC.json"
curl -L "https://cdn.jsdelivr.net/npm/jeelizwebarmakeup@1.0.6/dist/NNCwasm.js" -o "assets/lib/NNC/NNCwasm.js"
curl -L "https://cdn.jsdelivr.net/npm/jeelizwebarmakeup@1.0.6/dist/NNCwasm.wasm" -o "assets/lib/NNC/NNCwasm.wasm"

echo ""
echo "=================================="
echo "Download complete!"
echo "=================================="
echo ""
echo "Files downloaded:"
echo "✓ assets/lib/jeelizWebARMakeup.min.js"
echo "✓ assets/lib/NNC/NNC.json"
echo "✓ assets/lib/NNC/NNCwasm.js"
echo "✓ assets/lib/NNC/NNCwasm.wasm"
echo ""
echo "File sizes:"
ls -lh assets/lib/jeelizWebARMakeup.min.js
ls -lh assets/lib/NNC/
echo ""
echo "Next steps:"
echo "1. Verify file sizes look correct (should be ~800KB for main file, ~2MB for wasm)"
echo "2. Upload the entire plugin folder to your site"
echo "3. AR should now work!"
