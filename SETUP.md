# Server Setup

Instructions for setting up a fresh Ubuntu server to host Whisker.

## Prerequisites

- An Ubuntu server with SSH access
- An A record for `api.whisker.lmcmillan.dev` pointing to the server's IP
- Ports 80 and 443 open in the server's security group (80 for Let's Encrypt cert challenges, 443 for HTTPS)

## 1. Install Docker

```sh
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
```

Log out and back in for the group change to take effect.

## 2. Install Caddy

```sh
sudo apt-get update
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install -y caddy
```

## 3. Configure Caddy

Write the Caddyfile:

```sh
sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
api.whisker.lmcmillan.dev {
    reverse_proxy localhost:8022
}
EOF
```

To add more domains later, add another block to the same file.

## 4. Start Caddy

```sh
sudo systemctl enable caddy
sudo systemctl restart caddy
```

This may take a moment as Caddy provisions a TLS certificate from Let's Encrypt. Check status with:

```sh
sudo systemctl status caddy
journalctl -xeu caddy.service
```
