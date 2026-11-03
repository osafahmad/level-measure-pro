#!/usr/bin/env bash
# GDPR (EEA) consent testing for Debug builds. Flips only adsConfig.debug in
# src/features/ads/config.ts; both values are honoured in __DEV__ only and ignored in release.
#   on      EEA geography + reset consent on every launch (UMP form each cold launch)
#   eea     EEA geography, keep consent between launches
#   off     back to the committed defaults (null, false)
#   status  show the two values
# Local testing only: run "off" before committing. Prints no device IDs or other config.
set -euo pipefail
cd "$(dirname "$0")/.."
CONFIG=src/features/ads/config.ts

set_values() {
  perl -pi -e "s/^(\s+geography: )(null|'EEA'|'NOT_EEA')( as )/\${1}$1\${3}/; s/^(\s+resetConsentOnLaunch: )(true|false)(,)/\${1}$2\${3}/" "$CONFIG"
}

case "${1:-status}" in
  on) set_values "'EEA'" true ;;
  eea) set_values "'EEA'" false ;;
  off) set_values null false ;;
  status) ;;
  *) echo "usage: $0 on|eea|off|status" >&2; exit 2 ;;
esac
grep -E "^\s+(geography|resetConsentOnLaunch):" "$CONFIG" | sed -E 's/^ +/  /'
