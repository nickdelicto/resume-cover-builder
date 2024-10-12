/* eslint-disable no-var */

import { MongoClient } from 'mongodb'

// Check for the presence of the MongoDB URI in environment variables
if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
}

const uri = process.env.MONGODB_URI
const options = {}

let client: MongoClient
let clientPromise: Promise<MongoClient>

// Extend the NodeJS global type to include our custom property
declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

// In development mode, use a global variable to maintain the connection across hot-reloads
if (process.env.NODE_ENV === 'development') {
  if (!globalThis._mongoClientPromise) {
    client = new MongoClient(uri, options)
    globalThis._mongoClientPromise = client.connect()
  }
  clientPromise = globalThis._mongoClientPromise
} else {
  // In production mode, create a new client and connection promise for each instance
  client = new MongoClient(uri, options)
  clientPromise = client.connect()
}

// Export the clientPromise which is used in other parts of the application
export default clientPromise