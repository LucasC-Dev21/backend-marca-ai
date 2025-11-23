FROM node:latest

WORKDIR /usr/src

COPY . .
COPY ./.env.production ./.env

RUN npm install --quiet --no-optional --no-found ---loglevel=error

RUN npm run build

EXPOSE 3002

CMD ["npm", "run", "start:prod"]


#https://www.youtube.com/watch?v=fqr0mhQrASU
