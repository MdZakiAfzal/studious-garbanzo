# Use the lightweight Alpine Linux version of Node 18
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy the package files first to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Start the server using the dev script (Nodemon)
CMD ["npm", "run", "dev"]