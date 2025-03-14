FROM oven/bun:latest

WORKDIR /app

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