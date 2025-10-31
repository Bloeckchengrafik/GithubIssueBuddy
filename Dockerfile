# Stage 1: Install dependencies
FROM node:18-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install

# Stage 2: Create the final image
FROM node:18-alpine
WORKDIR /usr/src/app

# Copy dependencies from the builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy application code
COPY . .

# Expose the port the server runs on
EXPOSE 8081

# The command to run the application
CMD [ "node", "index.js" ]
