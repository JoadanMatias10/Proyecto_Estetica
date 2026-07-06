'use strict';

const http = require('http');
const https = require('https');

// Carga skill-config.json/.env mediante mongo.js sin exponer credenciales.
require('./mongo');

const DEFAULT_TIMEOUT_MS = 8500;

function normalizeBaseUrl(value = '') {
    const raw = String(value || '').trim().replace(/\/+$/, '');
    if (!raw) {
        return '';
    }
    return raw.endsWith('/api') ? raw : `${raw}/api`;
}

function getApiBaseUrl() {
    return normalizeBaseUrl(
        process.env.API_BASE_URL
        || process.env.BACKEND_API_URL
        || process.env.RENDER_API_URL
        || ''
    );
}

function hasApiConfig() {
    return Boolean(getApiBaseUrl());
}

function buildUrl(path, query = {}) {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) {
        throw new Error('Falta configurar API_BASE_URL en skill-config.json.');
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${baseUrl}${normalizedPath}`);
    for (const [key, value] of Object.entries(query || {})) {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, String(value));
        }
    }
    return url;
}

function requestJson(path, {
    method = 'GET',
    token = '',
    body = null,
    query = {},
    timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
    return new Promise((resolve, reject) => {
        let url;
        try {
            url = buildUrl(path, query);
        } catch (error) {
            reject(error);
            return;
        }

        const payload = body ? JSON.stringify(body) : '';
        const transport = url.protocol === 'http:' ? http : https;
        const request = transport.request(url, {
            method,
            timeout: timeoutMs,
            headers: {
                Accept: 'application/json',
                ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            }
        }, (response) => {
            let data = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
                data += chunk;
            });
            response.on('end', () => {
                let parsed = {};
                try {
                    parsed = data ? JSON.parse(data) : {};
                } catch (_error) {
                    parsed = {};
                }

                if (response.statusCode < 200 || response.statusCode >= 300) {
                    const message = Array.isArray(parsed.errors) && parsed.errors.length
                        ? parsed.errors[0]
                        : parsed.error || parsed.message || `Error HTTP ${response.statusCode}`;
                    const error = new Error(message);
                    error.statusCode = response.statusCode;
                    error.payload = parsed;
                    reject(error);
                    return;
                }

                resolve(parsed);
            });
        });

        request.on('timeout', () => {
            request.destroy(new Error('El servidor tardó demasiado en responder.'));
        });
        request.on('error', reject);

        if (payload) {
            request.write(payload);
        }
        request.end();
    });
}

async function getClientProfile(token) {
    return requestJson('/alexa/me', { token });
}

async function getClientStylists(token) {
    const data = await requestJson('/alexa/stylists', { token });
    return Array.isArray(data.stylists) ? data.stylists : [];
}

async function getStylistAvailability(token, stylistId, { desde, hasta = desde, serviceId = '' } = {}) {
    return requestJson(`/alexa/stylists/${encodeURIComponent(stylistId)}/availability`, {
        token,
        query: { desde, hasta, serviceId }
    });
}

async function createClientAppointment(token, appointment) {
    return requestJson('/alexa/appointments', {
        method: 'POST',
        token,
        body: appointment
    });
}

async function startAlexaLogin(identifier) {
    return requestJson('/alexa/auth/start', {
        method: 'POST',
        body: { identifier }
    });
}

async function verifyAlexaLogin(challengeId, code) {
    return requestJson('/alexa/auth/verify', {
        method: 'POST',
        body: { challengeId, code }
    });
}

module.exports = {
    getApiBaseUrl,
    hasApiConfig,
    requestJson,
    getClientProfile,
    getClientStylists,
    getStylistAvailability,
    createClientAppointment,
    startAlexaLogin,
    verifyAlexaLogin
};
