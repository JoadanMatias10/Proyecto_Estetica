'use strict';

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

let client;
let connectionPromise;
let localEnvironmentLoaded = false;

function loadLocalEnvironment() {
    if (localEnvironmentLoaded || process.env.DISABLE_LOCAL_ENV === 'true') {
        return;
    }

    localEnvironmentLoaded = true;

    const configPath = path.join(__dirname, '..', 'skill-config.json');
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            for (const [key, value] of Object.entries(config)) {
                if (!process.env[key] && value !== undefined && value !== null) {
                    process.env[key] = String(value);
                }
            }
        } catch (error) {
            console.error('No fue posible leer skill-config.json:', error.message);
        }
    }

    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) {
        return;
    }

    const contents = fs.readFileSync(envPath, 'utf8');
    for (const rawLine of contents.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }

        const separator = line.indexOf('=');
        if (separator < 1) {
            continue;
        }

        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"'))
            || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

function getDatabaseName() {
    loadLocalEnvironment();
    return process.env.MONGODB_DB || process.env.MONGODB_DB_NAME || '';
}

function hasMongoConfig() {
    loadLocalEnvironment();
    return Boolean(process.env.MONGODB_URI && getDatabaseName());
}

async function getDatabase() {
    if (!hasMongoConfig()) {
        return null;
    }

    if (!client) {
        loadLocalEnvironment();
        client = new MongoClient(process.env.MONGODB_URI, {
            maxPoolSize: 5,
            minPoolSize: 0,
            serverSelectionTimeoutMS: 2500,
            connectTimeoutMS: 2500
        });
    }

    if (!connectionPromise) {
        connectionPromise = client.connect().catch((error) => {
            connectionPromise = null;
            console.error('No fue posible conectar con MongoDB Atlas:', error.message);
            throw error;
        });
    }

    await connectionPromise;
    return client.db(getDatabaseName());
}

async function withDatabase(operation, fallbackValue) {
    try {
        const database = await getDatabase();
        if (!database) {
            return fallbackValue;
        }
        return await operation(database);
    } catch (error) {
        console.error('Operación de MongoDB no disponible:', error.message);
        return fallbackValue;
    }
}

loadLocalEnvironment();

module.exports = {
    hasMongoConfig,
    getDatabaseName,
    getDatabase,
    withDatabase
};
