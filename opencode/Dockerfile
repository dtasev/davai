FROM node:26-trixie-slim

RUN npm i -g opencode-ai && npm cache clean --force

WORKDIR /workspace

RUN touch /usr/local/bin/xdg-open; chmod +x /usr/local/bin/xdg-open

ENV OPENCODE_DATA_DIR=/workspace/opencode/data

CMD ["opencode"]
