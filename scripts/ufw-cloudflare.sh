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
# The blanket rule's name is host-specific — this server uses the 'WWW Full' app
# profile, a stock nginx box uses 'Nginx Full', others a plain port rule. Each
# also has separate v4 and v6 entries, so one delete per name is not enough.
#
# The retry is bounded and keys off ufw's own "could not delete" message rather
# than looping on `ufw status | grep`: on a re-run the Cloudflare rules added
# below render as "80,443/tcp", which contains "443/tcp" as a substring, so a
# status-driven loop would never terminate — a hung monthly cron job.
for rule in 'Nginx Full' 'WWW Full' 'WWW' 'WWW Secure' 80/tcp 443/tcp; do
  for _ in 1 2 3 4; do
    ufw --force delete allow "$rule" 2>&1 |
      grep -qiE 'could not delete|non-existent' && break
  done
done

echo "[*] Allowing 80/443 from Cloudflare only…"
while read -r cidr; do
  [ -z "$cidr" ] && continue
  ufw allow proto tcp from "$cidr" to any port 80,443 comment 'Cloudflare' >/dev/null
done <<<"$v4
$v6"

# Catch the failure mode this script was written for: if a blanket rule survives
# (an app profile under a name not covered above), the Cloudflare rules are
# merely additive and the origin stays open to the world — silently. Fail loud.
echo "[*] Verifying no blanket HTTP/HTTPS rule survived…"
# Anchored, with \b, so an unrelated 8080 rule doesn't trip this.
leftover=$(ufw status | grep -iE '(^|[[:space:]])(80\b|443\b|WWW|Nginx|Apache)' |
  grep -E 'Anywhere' || true)
if [ -n "$leftover" ]; then
  echo "[!] A blanket HTTP/HTTPS rule is still present — the origin remains" >&2
  echo "    reachable directly, bypassing Cloudflare:" >&2
  echo "$leftover" >&2
  echo "    Remove it by number with: ufw status numbered && ufw delete <n>" >&2
  exit 1
fi

echo "[*] Done. Current rules:"
ufw status numbered | grep -E 'Cloudflare|OpenSSH|22' || true

cat <<'NOTE'

[!] Verify from a machine OUTSIDE the server before you close this SSH session:

      curl -k --max-time 10 https://<ORIGIN-IP> -H "Host: joggediballa.ch"

    Expected: a timeout or connection refused. If it still returns HTTP 200,
    the rules did not take effect — do NOT log out until that is resolved.

    The site itself must stay reachable at https://joggediballa.ch.
NOTE
