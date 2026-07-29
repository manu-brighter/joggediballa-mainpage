#!/usr/bin/env bash
#
# Restrict HTTP/HTTPS to Cloudflare's published IP ranges.
#
# joggediballa.ch resolves to Cloudflare, not to the origin. Without this the
# origin also answers on its raw IP, so anyone who learns that address bypasses
# Cloudflare entirely — DDoS protection, WAF and rate limiting included. It also
# closes an X-Forwarded-For spoofing path: a direct request to the origin can
# forge the header the per-IP rate limiter reads.
#
# Run as root on the server. Safe to re-run — Cloudflare changes its ranges
# occasionally, so a monthly cron is reasonable:
#   0 4 1 * * /usr/local/bin/ufw-cloudflare.sh >> /var/log/ufw-cloudflare.log 2>&1
#
# SSH rules are never touched.

set -euo pipefail

V4_URL="https://www.cloudflare.com/ips-v4"
V6_URL="https://www.cloudflare.com/ips-v6"

echo "[*] Fetching Cloudflare ranges…"
v4=$(curl -fsSL --max-time 20 "$V4_URL")
v6=$(curl -fsSL --max-time 20 "$V6_URL")

# Refuse to touch the firewall on an empty or malformed download — otherwise a
# failed fetch would drop every allow rule and take the site offline.
if [ -z "$v4" ] || ! grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/[0-9]+$' <<<"$v4"; then
  echo "[!] IPv4 list looks wrong — aborting without changing the firewall." >&2
  exit 1
fi

echo "[*] Removing blanket HTTP/HTTPS rules…"
# `ufw delete` is a no-op with a warning when the rule isn't there.
ufw --force delete allow 'Nginx Full' 2>/dev/null || true
ufw --force delete allow 80/tcp 2>/dev/null || true
ufw --force delete allow 443/tcp 2>/dev/null || true

echo "[*] Allowing 80/443 from Cloudflare only…"
while read -r cidr; do
  [ -z "$cidr" ] && continue
  ufw allow proto tcp from "$cidr" to any port 80,443 comment 'Cloudflare' >/dev/null
done <<<"$v4
$v6"

echo "[*] Done. Current rules:"
ufw status numbered | grep -E 'Cloudflare|OpenSSH|22' || true

cat <<'NOTE'

[!] Verify from a machine OUTSIDE the server before you close this SSH session:

      curl -k --max-time 10 https://<ORIGIN-IP> -H "Host: joggediballa.ch"

    Expected: a timeout or connection refused. If it still returns HTTP 200,
    the rules did not take effect — do NOT log out until that is resolved.

    The site itself must stay reachable at https://joggediballa.ch.
NOTE
