FROM          node:22
RUN           useradd roboshop
RUN           mkdir /app && chown roboshop:roboshop /app
USER          roboshop
WORKDIR       /app
COPY          node_modules node_modules
COPY          server.js package.json ./
