# Use the specified Deno image
FROM denoland/deno:2.0.0-rc.10

# Set the working directory in the container
WORKDIR /app

# Copy the deno.json (if you have one) and the lock file (if you have one)
COPY deno.json* .
COPY deno.lock* .

# Copy the rest of your source code
COPY . .

# Compile the Deno project
RUN deno cache main.ts


EXPOSE 3000
# Run the app
CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-env","--allow-sys", "main.ts", "3000"]