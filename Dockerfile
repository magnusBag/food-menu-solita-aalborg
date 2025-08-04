FROM oven/bun:latest

WORKDIR /app

# Install curl for healthchecks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy package.json and bun.lockb (if it exists)
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install

# Copy the rest of the application
COPY . .

# Expose the port your application runs on (adjust as needed)
EXPOSE 3000

# Start the application
CMD ["bun", "run", "start"]
