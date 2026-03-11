#!/bin/bash

# =============================================================================
# RESET SCRCPY ON DEVICE - Quick Fix Script
# =============================================================================
# Usage: ./reset-device.sh <DEVICE_SERIAL>
# Example: ./reset-device.sh R9CW4014NQK
# =============================================================================

if [ -z "$1" ]; then
    echo "Usage: $0 <DEVICE_SERIAL>"
    echo "Example: $0 R9CW4014NQK"
    exit 1
fi

DEVICE="$1"

echo "═══════════════════════════════════════════════════════════════"
echo "  RESETTING SCRCPY ON DEVICE: $DEVICE"
echo "═══════════════════════════════════════════════════════════════"

echo ""
echo "[1/3] Killing old scrcpy process..."
adb -s "$DEVICE" shell "pidof app_process | xargs kill 2>/dev/null" || echo "  (no process found)"

echo ""
echo "[2/3] Clearing old JAR from device..."
adb -s "$DEVICE" shell "rm -f /data/local/tmp/scrcpy*" || echo "  (no files found)"

echo ""
echo "[3/3] Checking UHID support..."
if adb -s "$DEVICE" shell "ls /dev/uhid" 2>/dev/null; then
    echo "  ✅ UHID is AVAILABLE!"
else
    echo "  ❌ UHID NOT available on this device!"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ DEVICE RESET COMPLETE!"
echo "  Now restart ws-scrcpy and refresh browser."
echo "═══════════════════════════════════════════════════════════════"
