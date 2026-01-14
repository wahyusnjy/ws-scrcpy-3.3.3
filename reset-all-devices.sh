#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# RESET SCRCPY ON ALL CONNECTED DEVICES (Ubuntu/Linux Version)
# With diagnostic checks for scrcpy-server.jar and app_process
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}         RESET SCRCPY ON ALL CONNECTED DEVICES (Ubuntu)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Get list of connected devices
DEVICES=$(adb devices | grep -v "List" | grep -v "^$" | awk '{print $1}')

if [ -z "$DEVICES" ]; then
    echo -e "${RED}❌ No devices connected!${NC}"
    exit 1
fi

# Count devices
DEVICE_COUNT=$(echo "$DEVICES" | wc -l)
echo -e "${GREEN}📱 Found ${DEVICE_COUNT} device(s)${NC}"
echo ""

# Get device names
for DEVICE in $DEVICES; do
    MODEL=$(adb -s $DEVICE shell getprop ro.product.model 2>/dev/null | tr -d '\r\n' || echo "Unknown")
    echo -e "   - ${BLUE}$DEVICE${NC} ($MODEL)"
done
echo ""

# Process each device
CURRENT=0
for DEVICE in $DEVICES; do
    CURRENT=$((CURRENT + 1))
    MODEL=$(adb -s $DEVICE shell getprop ro.product.model 2>/dev/null | tr -d '\r\n' || echo "Unknown")
    
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}[$CURRENT/$DEVICE_COUNT] Processing: $DEVICE ($MODEL)${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
    
    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 1: CHECK FOR EXISTING SCRCPY-SERVER.JAR
    # ═══════════════════════════════════════════════════════════════════════════
    echo -e "  ${BLUE}[1/5] Checking for existing scrcpy-server.jar...${NC}"
    JAR_EXISTS=$(adb -s $DEVICE shell "ls -la /data/local/tmp/scrcpy-server.jar 2>/dev/null" | tr -d '\r\n' || echo "")
    if [ -n "$JAR_EXISTS" ]; then
        JAR_SIZE=$(echo "$JAR_EXISTS" | awk '{print $5}')
        echo -e "       ${GREEN}✅ Found: /data/local/tmp/scrcpy-server.jar (${JAR_SIZE} bytes)${NC}"
    else
        echo -e "       ${YELLOW}⚠️ NOT FOUND: /data/local/tmp/scrcpy-server.jar${NC}"
    fi
    
    # Also check for any scrcpy* files
    SCRCPY_FILES=$(adb -s $DEVICE shell "ls /data/local/tmp/scrcpy* 2>/dev/null" | tr -d '\r' || echo "")
    if [ -n "$SCRCPY_FILES" ]; then
        echo -e "       ${CYAN}Files found:${NC}"
        echo "$SCRCPY_FILES" | while read -r FILE; do
            [ -n "$FILE" ] && echo -e "         - $FILE"
        done
    fi
    
    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 2: CHECK FOR RUNNING APP_PROCESS (SCRCPY SERVER)
    # ═══════════════════════════════════════════════════════════════════════════
    echo -e "  ${BLUE}[2/5] Checking for running scrcpy process (app_process)...${NC}"
    SCRCPY_PIDS=$(adb -s $DEVICE shell "ps -A 2>/dev/null | grep app_process | grep -v grep" | awk '{print $2}' | tr '\r\n' ' ' || echo "")
    
    if [ -n "$SCRCPY_PIDS" ] && [ "$SCRCPY_PIDS" != " " ]; then
        echo -e "       ${GREEN}✅ Running PIDs: ${SCRCPY_PIDS}${NC}"
        
        # Get more details about the process
        for PID in $SCRCPY_PIDS; do
            if [ -n "$PID" ]; then
                CMDLINE=$(adb -s $DEVICE shell "cat /proc/$PID/cmdline 2>/dev/null" | tr '\0' ' ' | tr -d '\r' || echo "")
                if echo "$CMDLINE" | grep -q "scrcpy"; then
                    echo -e "       ${CYAN}→ PID $PID: scrcpy server${NC}"
                fi
            fi
        done
    else
        echo -e "       ${YELLOW}⚠️ No app_process running${NC}"
    fi
    
    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 3: KILL EXISTING SCRCPY PROCESSES
    # ═══════════════════════════════════════════════════════════════════════════
    echo -e "  ${BLUE}[3/5] Killing scrcpy processes...${NC}"
    KILLED_PIDS=""
    
    # Method 1: Kill by searching for scrcpy in command line
    for PID in $SCRCPY_PIDS; do
        if [ -n "$PID" ]; then
            CMDLINE=$(adb -s $DEVICE shell "cat /proc/$PID/cmdline 2>/dev/null" | tr '\0' ' ' || echo "")
            if echo "$CMDLINE" | grep -q "scrcpy"; then
                adb -s $DEVICE shell "kill -9 $PID" 2>/dev/null || true
                KILLED_PIDS="$KILLED_PIDS $PID"
            fi
        fi
    done
    
    # Method 2: Also try pkill
    adb -s $DEVICE shell "pkill -f scrcpy" 2>/dev/null || true
    
    if [ -n "$KILLED_PIDS" ]; then
        echo -e "       ${GREEN}✅ Killed PIDs:${KILLED_PIDS}${NC}"
    else
        echo -e "       ${YELLOW}⚠️ No processes to kill${NC}"
    fi
    
    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 4: CLEAR OLD JAR FILES
    # ═══════════════════════════════════════════════════════════════════════════
    echo -e "  ${BLUE}[4/5] Clearing old JAR files...${NC}"
    adb -s $DEVICE shell "rm -f /data/local/tmp/scrcpy*" 2>/dev/null || true
    
    # Verify deletion
    REMAINING=$(adb -s $DEVICE shell "ls /data/local/tmp/scrcpy* 2>/dev/null" | tr -d '\r' || echo "")
    if [ -z "$REMAINING" ]; then
        echo -e "       ${GREEN}✅ Cleared /data/local/tmp/scrcpy*${NC}"
    else
        echo -e "       ${RED}❌ Some files remain: $REMAINING${NC}"
    fi
    
    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 5: CHECK UHID SUPPORT
    # ═══════════════════════════════════════════════════════════════════════════
    echo -e "  ${BLUE}[5/5] Checking UHID support...${NC}"
    UHID_EXISTS=$(adb -s $DEVICE shell "ls /dev/uhid 2>/dev/null" | tr -d '\r' || echo "")
    if [ -n "$UHID_EXISTS" ]; then
        echo -e "       ${GREEN}✅ UHID is AVAILABLE (/dev/uhid exists)${NC}"
    else
        echo -e "       ${YELLOW}⚠️ UHID NOT available (keyboard/mouse may not work)${NC}"
    fi
    
    echo ""
done

# ═══════════════════════════════════════════════════════════════════════════════
# FINAL SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                    ✅ ALL $DEVICE_COUNT DEVICES RESET COMPLETE!${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Restart ws-scrcpy:  ${CYAN}npm start${NC}"
echo -e "  2. Refresh browser:    ${CYAN}Ctrl+Shift+R${NC} (hard refresh)"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
