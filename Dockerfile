# ---- Build Stage ----
# Use a Node.js image with all build tools for creating the production assets
FROM node:18-alpine AS build

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to leverage Docker layer caching
COPY package*.json ./

# Install all dependencies, including devDependencies needed for the build
RUN npm install

# Copy the rest of the application source code
COPY . .

# Run the build script defined in package.json to compile the React app
# This creates a 'dist' folder with optimized, static HTML, CSS, and JS files.
RUN npm run build


# ---- Production Stage ----
# Use a lightweight Node.js image for the final, smaller production container
FROM node:18-alpine

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install only the production dependencies needed to run the server
# The --omit=dev flag skips the build tools, making the final image smaller
RUN npm install --omit=dev

# Copy the compiled static files from the 'build' stage into the final image
COPY --from=build /usr/src/app/dist ./dist

# Copy the Express server file that will serve the static files
COPY server.js .

# Expose the port that the server will listen on
EXPOSE 8080

# Define the command to start the Node.js server when the container starts
CMD [ "node", "server.js" ]