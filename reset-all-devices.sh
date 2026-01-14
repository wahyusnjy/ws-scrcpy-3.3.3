#!/bin/bash

# =============================================================================
# RESET SCRCPY ON ALL CONNECTED DEVICES
# =============================================================================
# Usage: ./reset-all-devices.sh
# This script will:
#   1. Find all connected Android devices
#   2. Kill scrcpy process on each device
#   3. Clear old JAR files
#   4. Check UHID support
# =============================================================================

echo "═══════════════════════════════════════════════════════════════════════════"
echo "              RESET SCRCPY ON ALL CONNECTED DEVICES"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

# Get list of connected devices (skip header line, get only 'device' status)
DEVICES=()
while IFS= read -r line; do
    DEVICE=$(echo "$line" | awk '{print $1}')
    STATUS=$(echo "$line" | awk '{print $2}')
    if [ "$STATUS" = "device" ] && [ -n "$DEVICE" ]; then
        DEVICES+=("$DEVICE")
    fi
done < <(adb devices | tail -n +2)

DEVICE_COUNT=${#DEVICES[@]}

if [ "$DEVICE_COUNT" -eq 0 ]; then
    echo "❌ No devices connected!"
    echo ""
    echo "Make sure devices are connected and authorized:"
    echo "  adb devices"
    exit 1
fi

echo "📱 Found $DEVICE_COUNT device(s):"
for DEVICE in "${DEVICES[@]}"; do
    MODEL=$(adb -s "$DEVICE" shell getprop ro.product.model 2>/dev/null | tr -d '\r\n')
    echo "   - $DEVICE ($MODEL)"
done
echo ""

# Process each device
COUNTER=0

for DEVICE in "${DEVICES[@]}"; do
    COUNTER=$((COUNTER + 1))
    MODEL=$(adb -s "$DEVICE" shell getprop ro.product.model 2>/dev/null | tr -d '\r\n')
    
    echo "═══════════════════════════════════════════════════════════════════════════"
    echo "[$COUNTER/$DEVICE_COUNT] Processing: $DEVICE ($MODEL)"
    echo "═══════════════════════════════════════════════════════════════════════════"
    
    # Kill scrcpy process
    echo "  [1/3] Killing scrcpy process..."
    PID=$(adb -s "$DEVICE" shell "pidof app_process" 2>/dev/null | tr -d '\r\n')
    if [ -n "$PID" ]; then
        adb -s "$DEVICE" shell "kill $PID" 2>/dev/null
        echo "       ✅ Killed PID: $PID"
    else
        echo "       (no scrcpy process running)"
    fi
    
    # Clear old JAR
    echo "  [2/3] Clearing old JAR files..."
    adb -s "$DEVICE" shell "rm -f /data/local/tmp/scrcpy*" 2>/dev/null
    echo "       ✅ Cleared /data/local/tmp/scrcpy*"
    
    # Check UHID
    echo "  [3/3] Checking UHID support..."
    if adb -s "$DEVICE" shell "ls /dev/uhid" 2>/dev/null | grep -q uhid; then
        echo "       ✅ UHID is AVAILABLE"
    else
        echo "       ⚠️  UHID NOT available (UHID keyboard won't work)"
    fi
    
    echo ""
done

echo "═══════════════════════════════════════════════════════════════════════════"
echo "                      ✅ ALL $DEVICE_COUNT DEVICES RESET COMPLETE!"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Restart ws-scrcpy:  npm start"
echo "  2. Refresh browser:    Ctrl+Shift+R (hard refresh)"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
