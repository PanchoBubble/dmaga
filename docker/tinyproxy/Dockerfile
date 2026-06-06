# Minimal HTTP/HTTPS forward proxy for indexer-only VPN egress.
# Runs inside the nordvpn container's network namespace (see docker-compose.yml),
# so anything the app sends through it leaves via the VPN tunnel.
FROM alpine:3.20

RUN apk add --no-cache tinyproxy

COPY tinyproxy.conf /etc/tinyproxy/tinyproxy.conf

EXPOSE 8888

# -d keeps tinyproxy in the foreground so the container stays alive.
ENTRYPOINT ["tinyproxy", "-d", "-c", "/etc/tinyproxy/tinyproxy.conf"]
