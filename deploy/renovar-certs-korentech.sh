#!/bin/bash
# Roda de tempos em tempos (cron, na VPS — NÃO faz parte da imagem Docker)
# — verifica se algum tenant novo foi criado no super admin e, se sim,
# reemite o certificado korentech-atu incluindo o subdomínio dele. Sem
# isso, todo tenant novo fica em HTTP puro (funciona, mas navegador mostra
# "Não seguro") até alguém rodar certbot manualmente pra ele.
#
# Instalação na VPS (fora do escopo do docker-compose, é infra do host):
#   cp renovar-certs-korentech.sh /usr/local/bin/ && chmod +x /usr/local/bin/renovar-certs-korentech.sh
#   crontab -e   # adiciona: */10 * * * * /usr/local/bin/renovar-certs-korentech.sh >> /var/log/renovar-certs-korentech.log 2>&1
set -euo pipefail
cd /var/www/white-restaurante

SLUGS=$(docker compose exec -T postgres psql -U belfrango -d bel_do_frango_atu -t -A -c "SELECT slug FROM \"Tenant\" WHERE ativo = true ORDER BY slug;")

DOMINIOS="-d super.korentech.com.br"
while IFS= read -r slug; do
  [ -z "$slug" ] && continue
  DOMINIOS="$DOMINIOS -d ${slug}.korentech.com.br"
done <<< "$SLUGS"

ESTADO_ATUAL=$(echo "$SLUGS" | tr '\n' ',')
ARQUIVO_ESTADO=/etc/letsencrypt/korentech-atu-slugs.txt

if [ -f "$ARQUIVO_ESTADO" ] && [ "$(cat "$ARQUIVO_ESTADO")" = "$ESTADO_ATUAL" ]; then
  exit 0
fi

echo "[$(date -Is)] Tenants mudaram — reemitindo certificado korentech-atu com: $ESTADO_ATUAL"
# shellcheck disable=SC2086
certbot --nginx --cert-name korentech-atu $DOMINIOS --expand --non-interactive --agree-tos -m super@korentech.com.br --redirect

echo "$ESTADO_ATUAL" > "$ARQUIVO_ESTADO"
echo "[$(date -Is)] Certificado atualizado com sucesso."
