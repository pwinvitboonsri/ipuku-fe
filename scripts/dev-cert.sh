#!/usr/bin/env bash
# Local HTTPS for testing the PWA on a real tablet over the LAN.
# Creates a private CA (certificates/ipuku-dev-ca.pem) and a server cert for localhost,
# 127.0.0.1, this Mac's LAN IP and its Bonjour name (<LocalHostName>.local, which never changes).
# Install the CA on the tablet once, then run `npm run dev:https` and open https://<name>.local:3001.
# Re-run if you want the current IP covered too (the CA is reused, so the tablet doesn't need it again).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p certificates
cd certificates

LAN_IP="${1:-$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)}"
if [ -z "$LAN_IP" ]; then echo "Couldn't detect the LAN IP — pass it: npm run dev:cert -- 192.168.x.x" >&2; exit 1; fi
MDNS_NAME="$(scutil --get LocalHostName | tr '[:upper:]' '[:lower:]').local"

if [ ! -f ipuku-dev-ca.pem ]; then
  openssl req -x509 -new -nodes -newkey rsa:2048 -sha256 -days 825 \
    -keyout ipuku-dev-ca-key.pem -out ipuku-dev-ca.pem \
    -subj "/CN=Ippuku POS local dev CA" \
    -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" 2>/dev/null
  cp ipuku-dev-ca.pem ipuku-dev-ca.crt # .crt is what Android's installer expects
  echo "Created CA: certificates/ipuku-dev-ca.crt  ← install this on the tablet"
fi

cat > lan.ext <<EOF
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:localhost,DNS:${MDNS_NAME},IP:127.0.0.1,IP:${LAN_IP}
EOF
openssl req -new -nodes -newkey rsa:2048 -keyout lan-key.pem -out lan.csr -subj "/CN=${LAN_IP}" 2>/dev/null
openssl x509 -req -in lan.csr -CA ipuku-dev-ca.pem -CAkey ipuku-dev-ca-key.pem -CAcreateserial \
  -out lan.pem -days 397 -sha256 -extfile lan.ext 2>/dev/null
rm -f lan.csr lan.ext
echo "Server cert for localhost, ${MDNS_NAME}, 127.0.0.1, ${LAN_IP}: certificates/lan.pem"
echo "Open on the tablet: https://${MDNS_NAME}:3001"
