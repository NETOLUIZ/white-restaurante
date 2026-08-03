# node:20-slim (Debian/glibc), não alpine — sharp usa binário nativo prebuilt
# do libvips, mais confiável em glibc do que em musl (alpine).
FROM node:20-slim

# node:20-slim não vem com OpenSSL — sem isso o Prisma não detecta a versão
# de libssl certa pra baixar o query engine e cai num fallback que pode
# quebrar em runtime (aviso visto no build: "Prisma failed to detect the
# libssl/openssl version").
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npx prisma generate

# uploads/ é sobrescrito por um volume nomeado no docker-compose — o mkdir
# aqui só garante que o caminho exista antes do primeiro upload num volume novo.
RUN mkdir -p uploads

EXPOSE 3010

CMD ["node", "src/server.js"]
