'use strict';

const Alexa = require('ask-sdk-core');
const {
    getProducts,
    getServices,
    findProduct,
    findService,
    findItem,
    normalizeText
} = require('./lib/catalog');
const {
    hasApiConfig,
    getClientProfile,
    getClientStylists,
    getStylistAvailability,
    createClientAppointment,
    startAlexaLogin,
    verifyAlexaLogin,
    startStylistAlexaLogin,
    verifyStylistAlexaLogin,
    getStylistDashboardProfile,
    getStylistAppointments
} = require('./lib/api');
const {
    addAPLDirective,
    welcomeData,
    listData,
    detailData,
    infoData,
    appointmentData,
    stylistDashboardData,
    goodbyeData
} = require('./lib/apl');

const WEEKDAY_HOURS = process.env.WEEKDAY_HOURS || '9:00 a. m. – 7:00 p. m.';
const SATURDAY_HOURS = process.env.SATURDAY_HOURS || '9:00 a. m. – 7:00 p. m.';
const SUNDAY_HOURS = process.env.SUNDAY_HOURS || 'Cerrado';
const BUSINESS_HOURS = process.env.BUSINESS_HOURS
    || `Nuestro horario de lunes a viernes es de ${WEEKDAY_HOURS}. El sábado abrimos de ${SATURDAY_HOURS}. El domingo: ${SUNDAY_HOURS}.`;

const HELP_SPEECH = 'Puedo mostrarte nuestros servicios y productos, consultar precios y horarios, o ayudarte a solicitar una cita. Por ejemplo, di: quiero agendar una cita, qué productos tienen, o cuánto cuesta un corte para mujer.';

function getResolvedSlotValue(handlerInput, slotName) {
    const intent = handlerInput.requestEnvelope.request.intent;
    const slot = intent && intent.slots && intent.slots[slotName];

    if (!slot) {
        return '';
    }

    const authorities = slot.resolutions
        && slot.resolutions.resolutionsPerAuthority;

    if (Array.isArray(authorities)) {
        for (const authority of authorities) {
            const values = authority.values;
            if (authority.status
                && authority.status.code === 'ER_SUCCESS_MATCH'
                && Array.isArray(values)
                && values[0]
                && values[0].value
                && values[0].value.name) {
                return values[0].value.name;
            }
        }
    }

    return slot.value || '';
}

function getSessionAttributes(handlerInput) {
    return handlerInput.attributesManager.getSessionAttributes() || {};
}

function setSessionAttributes(handlerInput, attributes) {
    handlerInput.attributesManager.setSessionAttributes(attributes);
}

function formatDateLabel(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
        return value || '';
    }

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    return new Intl.DateTimeFormat('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(date);
}

function formatTimeLabel(value) {
    if (!/^\d{2}:\d{2}$/.test(value || '')) {
        return value || '';
    }

    const [hours, minutes] = value.split(':').map(Number);
    const suffix = hours >= 12 ? 'de la tarde' : 'de la mañana';
    const displayHours = hours % 12 || 12;
    return minutes === 0
        ? `${displayHours} ${suffix}`
        : `${displayHours}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function addDaysIso(offset) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
}

function nextAppointmentDays() {
    const days = [];
    let offset = 1;
    while (days.length < 3 && offset < 10) {
        const value = addDaysIso(offset);
        const [year, month, day] = value.split('-').map(Number);
        const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
        if (weekday !== 0) {
            days.push({
                label: offset === 1 ? 'Mañana' : formatDateLabel(value).replace(/ de /g, ' '),
                value
            });
        }
        offset += 1;
    }
    return days;
}

function appointmentOption(label, field, value) {
    return {
        label,
        action: 'appointmentSet',
        field,
        value,
        enabled: true
    };
}

function actionOption(label, action, value = '') {
    return {
        label,
        action,
        field: '',
        value,
        enabled: true
    };
}

function formatStylistAvailability(stylists) {
    if (!stylists.length) {
        return 'No encontré estilistas disponibles para ese día. Puedes elegir otro día.';
    }

    return stylists.slice(0, 3).map((stylist) => {
        const times = stylist.slots.slice(0, 3).map(formatTimeLabel).join(', ');
        return `${stylist.name}: ${times}`;
    }).join(' · ');
}

function availableTimeOptions(stylists, preferredStylist = '') {
    const normalizedPreferred = normalizeText(preferredStylist);
    const noPreference = ['sin preferencia', 'estilista disponible', 'cualquier estilista'].includes(normalizedPreferred);
    const source = normalizedPreferred && !noPreference
        ? stylists.find((stylist) => normalizeText(stylist.name) === normalizedPreferred)
        : stylists[0];

    if (!source) {
        return [];
    }

    return source.slots.slice(0, 3).map((time) => appointmentOption(formatTimeLabel(time), 'time', time));
}

function isNoStylistPreference(value = '') {
    return ['sin preferencia', 'estilista disponible', 'cualquier estilista', 'cualquiera'].includes(normalizeText(value));
}

function getSystemUser(handlerInput) {
    return handlerInput.requestEnvelope.context
        && handlerInput.requestEnvelope.context.System
        && handlerInput.requestEnvelope.context.System.user
        ? handlerInput.requestEnvelope.context.System.user
        : {};
}

function getClientAccessToken(handlerInput) {
    const attributes = getSessionAttributes(handlerInput);
    if (attributes.alexaAuth && attributes.alexaAuth.token) {
        return String(attributes.alexaAuth.token).trim();
    }

    const systemUser = getSystemUser(handlerInput);
    return String(
        systemUser.accessToken
        || process.env.ALEXA_CLIENT_TOKEN
        || process.env.CLIENT_ACCESS_TOKEN
        || process.env.TEST_CLIENT_TOKEN
        || ''
    ).trim();
}

function isUnauthorizedError(error) {
    return error && (error.statusCode === 401 || error.statusCode === 403);
}

function clearAlexaAuth(handlerInput) {
    const attributes = getSessionAttributes(handlerInput);
    delete attributes.alexaAuth;
    delete attributes.authChallenge;
    delete attributes.authInput;
    delete attributes.authCodeInput;
    delete attributes.stylistAuth;
    delete attributes.stylistAuthChallenge;
    delete attributes.stylistAuthInput;
    delete attributes.stylistAuthCodeInput;
    setSessionAttributes(handlerInput, attributes);
}

function clearStylistSession(handlerInput) {
    const attributes = getSessionAttributes(handlerInput);
    delete attributes.stylistAuth;
    delete attributes.stylistAuthChallenge;
    delete attributes.stylistAuthInput;
    delete attributes.stylistAuthCodeInput;
    setSessionAttributes(handlerInput, attributes);
}

function buildIdentifierIntent(value = '') {
    const slot = {
        name: 'identificadorCliente',
        confirmationStatus: 'NONE'
    };
    if (value) {
        slot.value = value;
    }

    return {
        name: 'IdentificarClienteIntent',
        confirmationStatus: 'NONE',
        slots: {
            identificadorCliente: slot
        }
    };
}

function buildCodeVerificationIntent(value = '') {
    const slot = {
        name: 'codigoVerificacion',
        confirmationStatus: 'NONE'
    };
    if (value) {
        slot.value = value;
    }

    return {
        name: 'VerificarCodigoAlexaIntent',
        confirmationStatus: 'NONE',
        slots: {
            codigoVerificacion: slot
        }
    };
}
function renderAuthStartPrompt(handlerInput, reason = '', speak = true) {
    const attributes = getSessionAttributes(handlerInput);
    const authInput = String(attributes.authInput || '').replace(/\D/g, '').slice(0, 10);
    attributes.authChallenge = {
        stage: 'identifier',
        pendingAction: 'appointment'
    };
    setSessionAttributes(handlerInput, attributes);

    const speech = reason
        ? `${reason} Para agendar necesito validar tu cuenta de cliente. Dime tu teléfono de diez dígitos o tu correo registrado. También puedes tocar tu teléfono en la pantalla.`
        : 'Para agendar necesito validar tu cuenta de cliente. Dime tu teléfono de diez dígitos o tu correo registrado. También puedes tocar tu teléfono en la pantalla.';
    const data = appointmentData({
        service: 'Validar cliente',
        status: 'Dime tu teléfono o correo registrado.',
        authMode: 'phone',
        authDigits: authInput
    }, speech, [
        actionOption('Inicio', 'home'),
        actionOption('Ver servicios', 'services'),
        actionOption('Salir', 'exit')
    ]);

    if (!speak) {
        addAPLDirective(handlerInput, 'appointment', data, 'validar-cliente');
        return handlerInput.responseBuilder.getResponse();
    }

    return makeResponse(handlerInput, {
        speech,
        reprompt: 'Dime tu teléfono registrado de diez dígitos, tu correo registrado, o toca los números en pantalla.',
        documentName: 'appointment',
        data,
        token: 'validar-cliente'
    });
}
function renderAuthCodePrompt(handlerInput, challenge, speechOverride = '', speak = true) {
    const attributes = getSessionAttributes(handlerInput);
    const authCodeInput = String(attributes.authCodeInput || '').replace(/\D/g, '').slice(0, 6);
    const speech = speechOverride
        || `Te envié un código a ${challenge.delivery || 'tu correo registrado'}. Dime el código de seis dígitos o tócalo en la pantalla para continuar.`;
    const data = appointmentData({
        service: 'Validar código',
        status: `Código enviado a ${challenge.delivery || 'tu correo'}`,
        authMode: 'code',
        authDigits: authCodeInput
    }, speech, [
        actionOption('Reenviar código', 'authRestart'),
        actionOption('Inicio', 'home'),
        actionOption('Salir', 'exit')
    ]);

    if (!speak) {
        addAPLDirective(handlerInput, 'appointment', data, 'codigo-cliente');
        return handlerInput.responseBuilder.getResponse();
    }

    const builder = handlerInput.responseBuilder
        .speak(speech)
        .reprompt('Dime el codigo de seis digitos que llego a tu correo, o tocalo en pantalla.');

    addAPLDirective(handlerInput, 'appointment', data, 'codigo-cliente');
    builder.addElicitSlotDirective('codigoVerificacion', buildCodeVerificationIntent(authCodeInput));

    return builder.getResponse();
}

function getInputTranscript(handlerInput) {
    return String(handlerInput.requestEnvelope.request.inputTranscript || '').trim();
}

function collectRequestStrings(value, output = []) {
    if (typeof value === 'string') {
        output.push(value);
        return output;
    }

    if (!value || typeof value !== 'object') {
        return output;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            collectRequestStrings(item, output);
        }
        return output;
    }

    for (const [key, child] of Object.entries(value)) {
        if ([
            'requestId',
            'timestamp',
            'locale',
            'type',
            'dialogState',
            'confirmationStatus'
        ].includes(key)) {
            continue;
        }
        collectRequestStrings(child, output);
    }

    return output;
}

function extractSixDigitCodeFromRequest(handlerInput) {
    const request = handlerInput.requestEnvelope && handlerInput.requestEnvelope.request
        ? handlerInput.requestEnvelope.request
        : {};
    const strings = collectRequestStrings(request);

    for (const text of strings) {
        const normalized = normalizeSpokenDigits(text);
        if (/^\d{6}$/.test(normalized)) {
            return normalized;
        }
    }

    return '';
}

async function processClientIdentifier(handlerInput, rawIdentifier, emptyReason = 'No alcancé a tomar tu dato.') {
    if (!hasApiConfig()) {
        return renderApiConfigRequired(handlerInput);
    }

    const identifier = normalizeSpokenIdentifier(rawIdentifier);
    if (!identifier) {
        return renderAuthStartPrompt(handlerInput, emptyReason);
    }

    try {
        const challenge = await startAlexaLogin(identifier);
        const attributes = getSessionAttributes(handlerInput);
        attributes.authChallenge = {
            stage: 'code',
            challengeId: challenge.challengeId,
            delivery: challenge.delivery,
            identifier,
            pendingAction: 'appointment'
        };
        delete attributes.authInput;
        attributes.authCodeInput = '';
        setSessionAttributes(handlerInput, attributes);
        return renderAuthCodePrompt(handlerInput, attributes.authChallenge);
    } catch (error) {
        console.error('No fue posible iniciar validación Alexa:', error.message);
        return renderAuthStartPrompt(handlerInput, error.message || 'No pude enviar el código.');
    }
}

async function processClientCode(handlerInput, rawCode, alternateRawCode = '') {
    const attributes = getSessionAttributes(handlerInput);
    const challenge = attributes.authChallenge;
    if (!challenge || !challenge.challengeId) {
        return renderAuthStartPrompt(handlerInput, 'Primero necesito enviarte un código.');
    }

    const candidates = [
        rawCode,
        alternateRawCode,
        getInputTranscript(handlerInput),
        extractSixDigitCodeFromRequest(handlerInput),
        attributes.authCodeInput
    ].filter((value, index, array) => value && array.indexOf(value) === index);

    let code = '';
    for (const candidate of candidates) {
        const normalized = normalizeSpokenDigits(candidate);
        if (/^\d{6}$/.test(normalized)) {
            code = normalized;
            break;
        }
        if (!code && normalized) {
            code = normalized;
        }
    }

    console.log(`Código Alexa recibido. Candidatos: ${JSON.stringify(candidates)}. Normalizado: ${code}`);

    if (!/^\d{6}$/.test(code)) {
        attributes.authCodeInput = String(code || '').slice(0, 6);
        setSessionAttributes(handlerInput, attributes);
        const heard = getInputTranscript(handlerInput);
        const debugText = heard
            ? ` Escuché: ${heard}. Lo convertí a: ${code || 'sin número'}.`
            : '';
        return renderAuthCodePrompt(handlerInput, challenge, `El código debe tener seis dígitos. Dímelo nuevamente o tócalo completo en pantalla.${debugText}`);
    }

    try {
        const result = await verifyAlexaLogin(challenge.challengeId, code);
        attributes.alexaAuth = {
            token: result.token,
            user: result.user,
            expiresInMinutes: result.expiresInMinutes
        };
        delete attributes.authChallenge;
        delete attributes.authInput;
        delete attributes.authCodeInput;
        if (!attributes.appointmentDraft || attributes.appointmentDraft.complete) {
            attributes.appointmentDraft = createEmptyAppointmentDraft(result.user && result.user.nombre);
        } else {
            attributes.appointmentDraft.clientName = result.user && result.user.nombre || '';
        }
        setSessionAttributes(handlerInput, attributes);
        return renderAppointmentState(handlerInput, attributes.appointmentDraft);
    } catch (error) {
        console.error('No fue posible verificar código Alexa:', error.message);
        return renderAuthCodePrompt(handlerInput, challenge, error.message || 'No pude verificar el código. Inténtalo otra vez.');
    }
}

async function handleAuthDigitButton(handlerInput, digit) {
    const cleanDigit = String(digit || '').replace(/\D/g, '').slice(0, 1);
    if (!cleanDigit) {
        return renderAuthStartPrompt(handlerInput, 'No reconocí ese número.');
    }

    const attributes = getSessionAttributes(handlerInput);
    const challenge = attributes.authChallenge || { stage: 'identifier', pendingAction: 'appointment' };

    if (challenge.stage === 'code') {
        attributes.authCodeInput = `${attributes.authCodeInput || ''}${cleanDigit}`.replace(/\D/g, '').slice(0, 6);
        setSessionAttributes(handlerInput, attributes);
        if (attributes.authCodeInput.length >= 6) {
            return processClientCode(handlerInput, attributes.authCodeInput);
        }
        return renderAuthCodePrompt(handlerInput, challenge, '', false);
    }

    attributes.authChallenge = {
        stage: 'identifier',
        pendingAction: 'appointment'
    };
    attributes.authInput = `${attributes.authInput || ''}${cleanDigit}`.replace(/\D/g, '').slice(0, 10);
    setSessionAttributes(handlerInput, attributes);
    if (attributes.authInput.length >= 10) {
        return processClientIdentifier(handlerInput, attributes.authInput);
    }
    return renderAuthStartPrompt(handlerInput, '', false);
}

function handleAuthClearButton(handlerInput) {
    const attributes = getSessionAttributes(handlerInput);
    if (attributes.stylistAuthChallenge) {
        return handleStylistAuthClearButton(handlerInput);
    }
    const challenge = attributes.authChallenge || { stage: 'identifier' };
    if (challenge.stage === 'code') {
        attributes.authCodeInput = '';
        setSessionAttributes(handlerInput, attributes);
        return renderAuthCodePrompt(handlerInput, challenge, 'Borré el código. Captúralo nuevamente.');
    }

    attributes.authInput = '';
    setSessionAttributes(handlerInput, attributes);
    return renderAuthStartPrompt(handlerInput, 'Borré el teléfono. Captúralo nuevamente.');
}

async function handleAuthSubmitButton(handlerInput) {
    const attributes = getSessionAttributes(handlerInput);
    if (attributes.stylistAuthChallenge) {
        return handleStylistAuthSubmitButton(handlerInput);
    }
    const challenge = attributes.authChallenge || { stage: 'identifier' };
    if (challenge.stage === 'code') {
        return processClientCode(handlerInput, attributes.authCodeInput || '');
    }
    return processClientIdentifier(handlerInput, attributes.authInput || '', 'Captura tu teléfono completo de diez dígitos.');
}
function renderApiConfigRequired(handlerInput) {
    return makeResponse(handlerInput, {
        speech: 'Falta configurar la URL del backend para conectar Alexa con tu servidor real de Render.',
        reprompt: 'Puedes decir volver al inicio.',
        documentName: 'info',
        data: infoData({
            title: 'Falta API_BASE_URL',
            subtitle: 'Conecta Alexa con Render',
            body: 'Agrega API_BASE_URL en skill-config.json con la URL de tu backend terminada en diagonal api.',
            sections: [
                { title: 'Ejemplo', text: 'API_BASE_URL debe verse como https://tu-servidor.onrender.com/api' },
                { title: 'Importante', text: 'Sin esa URL no puedo validar clientes, estilistas ni guardar citas reales.' }
            ],
            primaryAction: 'home',
            primaryLabel: 'Volver al inicio'
        }),
        token: 'api-config'
    });
}

async function ensureClientSession(handlerInput) {
    if (!hasApiConfig()) {
        return {
            ok: false,
            response: renderApiConfigRequired(handlerInput)
        };
    }

    const token = getClientAccessToken(handlerInput);
    if (!token) {
        return {
            ok: false,
            response: renderAuthStartPrompt(handlerInput)
        };
    }

    try {
        const data = await getClientProfile(token);
        const user = data && data.user ? data.user : null;
        if (!user || user.role !== 'client') {
            return {
                ok: false,
                response: renderAuthStartPrompt(handlerInput, 'La sesión actual no corresponde a un cliente.')
            };
        }
        return { ok: true, token, user };
    } catch (error) {
        console.error('No fue posible validar el cliente para Alexa:', error.message);
        return {
            ok: false,
            response: isUnauthorizedError(error)
                ? renderAuthStartPrompt(handlerInput, 'Tu sesión de cliente venció o no está activa.')
                : makeResponse(handlerInput, {
                    speech: 'No pude validar tu cuenta con el servidor en este momento. Revisa que el backend de Render esté disponible.',
                    reprompt: 'Puedes decir volver al inicio.',
                    documentName: 'info',
                    data: infoData({
                        title: 'No pude validar tu cuenta',
                        subtitle: 'Servidor no disponible',
                        body: 'Alexa intentó contactar tu backend real, pero la validación no respondió correctamente.',
                        sections: [
                            { title: 'Revisa Render', text: 'Confirma que el servidor esté activo.' },
                            { title: 'Revisa API_BASE_URL', text: 'Debe apuntar a la API real terminada en /api.' }
                        ],
                        primaryAction: 'home',
                        primaryLabel: 'Volver al inicio'
                    }),
                    token: 'cliente-no-validado'
                })
        };
    }
}

async function resolveServiceForDraft(draft) {
    if (draft.serviceId && draft.service) {
        return {
            id: draft.serviceId,
            name: draft.service,
            price: draft.servicePrice || '',
            duration: draft.serviceDuration || ''
        };
    }

    const item = await findService(draft.service || '');
    if (!item || item.source !== 'mongodb') {
        return null;
    }

    draft.serviceId = item.id;
    draft.service = item.name;
    draft.servicePrice = item.price || '';
    draft.serviceDuration = item.duration || '';

    return {
        id: item.id,
        name: item.name,
        price: item.price || '',
        duration: item.duration || ''
    };
}

function normalizeBackendStylist(stylist, slots = []) {
    return {
        id: String(stylist.id || stylist._id || ''),
        name: stylist.nombre || stylist.name || 'Estilista',
        email: stylist.email || '',
        slots: Array.isArray(slots) ? slots : []
    };
}

async function getAvailableStylistsForDraft(token, draft) {
    const service = await resolveServiceForDraft(draft);
    if (!service || !draft.day) {
        return [];
    }

    const stylists = await getClientStylists(token);
    const withAvailability = [];

    for (const stylist of stylists) {
        const stylistId = String(stylist.id || stylist._id || '');
        if (!stylistId) {
            continue;
        }

        try {
            const availability = await getStylistAvailability(token, stylistId, {
                desde: draft.day,
                hasta: draft.day,
                serviceId: service.id
            });
            const day = Array.isArray(availability.days) ? availability.days[0] : null;
            const slots = Array.isArray(day && day.slots) ? day.slots : [];
            if (slots.length) {
                withAvailability.push(normalizeBackendStylist(availability.stylist || stylist, slots));
            }
        } catch (error) {
            console.warn(`No fue posible consultar disponibilidad del estilista ${stylistId}:`, error.message);
        }
    }

    return withAvailability;
}

function findAvailableStylist(availableStylists, draft) {
    if (draft.stylistId) {
        return availableStylists.find((stylist) => String(stylist.id) === String(draft.stylistId)) || null;
    }

    const normalized = normalizeText(draft.stylist || '');
    if (!normalized || isNoStylistPreference(normalized)) {
        return availableStylists[0] || null;
    }

    return availableStylists.find((stylist) => normalizeText(stylist.name) === normalized) || null;
}

function firstTimeOptionsForStylist(stylist) {
    return stylist && Array.isArray(stylist.slots)
        ? stylist.slots.slice(0, 3).map((time) => appointmentOption(formatTimeLabel(time), 'time', time))
        : [];
}

function makeResponse(handlerInput, {
    speech,
    reprompt = '',
    documentName,
    data,
    token,
    shouldEndSession = false
}) {
    const builder = handlerInput.responseBuilder.speak(speech);

    if (reprompt && !shouldEndSession) {
        builder.reprompt(reprompt);
    }

    if (documentName) {
        addAPLDirective(handlerInput, documentName, data, token);
    }

    if (shouldEndSession) {
        builder.withShouldEndSession(true);
    }

    return builder.getResponse();
}

function renderWelcome(handlerInput, speech) {
    return makeResponse(handlerInput, {
        speech,
        reprompt: 'Puedes decir servicios, productos, precios, horarios o agendar una cita.',
        documentName: 'welcome',
        data: welcomeData(),
        token: 'inicio'
    });
}

async function renderCatalog(handlerInput, kind, speechOverride = '', requestedPage = 0) {
    const isProduct = kind === 'product';
    const items = isProduct ? await getProducts() : await getServices();
    const source = items[0] && items[0].source;

    if (source === 'configuration-missing') {
        return makeResponse(handlerInput, {
            speech: 'Alexa no encontró la configuración de MongoDB. Revisa que el archivo skill-config.json esté guardado en la raíz del proyecto.',
            reprompt: 'Puedes decir volver al inicio.',
            documentName: 'info',
            data: infoData({
                title: 'Falta configurar Atlas',
                subtitle: 'No encontré MONGODB_URI o MONGODB_DB_NAME',
                body: 'Revisa que skill-config.json esté junto a index.js, tenga formato JSON válido y contenga los valores exactos de tu archivo punto env.',
                sections: [
                    {
                        title: 'Ubicación correcta',
                        text: 'skill-config.json debe estar en la raíz, no dentro de lib ni de apl.'
                    },
                    {
                        title: 'Nombres exactos',
                        text: 'Usa MONGODB_URI y MONGODB_DB_NAME respetando mayúsculas y guiones bajos.'
                    }
                ],
                primaryAction: 'home',
                primaryLabel: 'Volver al inicio'
            }),
            token: 'configuracion-faltante'
        });
    }

    if (source === 'fallback') {
        return makeResponse(handlerInput, {
            speech: 'No pude conectar con MongoDB Atlas desde Alexa. La configuración existe, pero Atlas no respondió antes del límite de tiempo. Revisa el acceso de red de Atlas y vuelve a intentarlo.',
            reprompt: 'Puedes decir volver al inicio.',
            documentName: 'info',
            data: infoData({
                title: 'Atlas no respondió',
                subtitle: 'La pantalla está funcionando',
                body: 'Alexa no logró conectarse a MongoDB Atlas. Revisa Network Access y que MONGODB_URI y MONGODB_DB_NAME estén escritos correctamente en skill-config.json.',
                sections: [
                    {
                        title: 'Configuración',
                        text: 'Confirma que skill-config.json esté en la raíz, junto a index.js.'
                    },
                    {
                        title: 'MongoDB Atlas',
                        text: 'La red debe permitir conexiones desde la infraestructura de Alexa-hosted.'
                    }
                ],
                primaryAction: 'home',
                primaryLabel: 'Volver al inicio'
            }),
            token: 'atlas-no-disponible'
        });
    }

    if (source === 'mongodb-empty') {
        return makeResponse(handlerInput, {
            speech: `La conexión con Atlas funciona, pero la colección de ${isProduct ? 'productos' : 'servicios'} está vacía.`,
            reprompt: 'Puedes decir volver al inicio.',
            documentName: 'info',
            data: infoData({
                title: 'Colección vacía',
                subtitle: isProduct ? 'productos' : 'servicios',
                body: 'Alexa se conectó correctamente a Atlas, pero no encontró documentos en esta colección.',
                sections: [],
                primaryAction: 'home',
                primaryLabel: 'Volver al inicio'
            }),
            token: 'coleccion-vacia'
        });
    }

    const pageSize = 6;
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const page = Math.min(
        totalPages - 1,
        Math.max(0, Number.parseInt(requestedPage, 10) || 0)
    );
    const visibleItems = items.slice(page * pageSize, (page + 1) * pageSize);
    const title = isProduct ? 'Productos AVYNA' : 'Nuestros servicios';
    const subtitle = isProduct
        ? 'Toca un producto para conocer sus detalles. Usa las flechas para ver más.'
        : 'Toca un servicio para ver sus detalles. Usa las flechas para ver más.';
    const names = visibleItems.slice(0, 4).map((item) => item.displayName || item.name).join(', ');
    const pageSpeech = page > 0 ? ` Esta es la página ${page + 1} de ${totalPages}.` : '';
    const speech = speechOverride || (isProduct
        ? `Encontré ${items.length} productos reales. En esta pantalla puedes ver ${names}.${pageSpeech} Toca uno para conocer sus detalles.`
        : `Encontré ${items.length} servicios reales. En esta pantalla puedes ver ${names}.${pageSpeech} Toca uno para conocer sus detalles.`);

    return makeResponse(handlerInput, {
        speech,
        reprompt: isProduct
            ? '¿Qué producto te interesa?'
            : '¿Qué servicio te interesa?',
        documentName: 'list',
        data: listData({
            title,
            subtitle,
            kind,
            items: visibleItems,
            totalItems: items.length,
            page,
            totalPages
        }),
        token: `${isProduct ? 'productos' : 'servicios'}-${page + 1}`
    });
}

function renderItemDetail(handlerInput, item, kind, speechOverride = '') {
    const isProduct = kind === 'product';
    const durationSpeech = item.duration ? ` La duración aproximada es de ${item.duration}.` : '';
    const measurementSpeech = item.measurement ? ` en presentación de ${item.measurement}` : '';
    const availabilitySpeech = isProduct && item.stock > 0
        ? ` Hay ${item.stock} disponibles.`
        : '';
    const speech = speechOverride || (isProduct
        ? `${item.name}${measurementSpeech} tiene un precio de ${item.price}.${availabilitySpeech} ${item.description}`
        : `${item.name} tiene un precio de ${item.price}.${durationSpeech} ${item.description}`);

    return makeResponse(handlerInput, {
        speech,
        reprompt: isProduct
            ? 'Puedes preguntarme por otro producto o volver al inicio.'
            : 'Puedes decir: quiero agendar este servicio, o preguntarme por otro servicio.',
        documentName: 'detail',
        data: detailData({ item, kind }),
        token: `${kind}-${item.id}`
    });
}

function renderHours(handlerInput) {
    const sections = [
        { title: 'Lunes a viernes', text: WEEKDAY_HOURS },
        { title: 'Sábado', text: SATURDAY_HOURS },
        { title: 'Domingo', text: SUNDAY_HOURS }
    ];

    return makeResponse(handlerInput, {
        speech: `${BUSINESS_HOURS} ¿Deseas consultar un servicio o agendar una cita?`,
        reprompt: 'Puedes decir: quiero agendar una cita, o volver al inicio.',
        documentName: 'info',
        data: infoData({
            title: 'Horario de atención',
            subtitle: 'Organiza tu próxima visita',
            body: 'Te recomendamos solicitar tu cita con anticipación para asegurar el horario y estilista que prefieras.',
            sections,
            primaryAction: 'appointment',
            primaryLabel: 'Agendar una cita'
        }),
        token: 'horarios'
    });
}

function renderHelp(handlerInput) {
    return makeResponse(handlerInput, {
        speech: `${HELP_SPEECH} ¿Qué deseas hacer?`,
        reprompt: 'Puedes decir: muéstrame los servicios, o quiero agendar una cita.',
        documentName: 'info',
        data: infoData({
            title: '¿Cómo puedo ayudarte?',
            subtitle: 'Usa tu voz o toca una opción',
            body: 'Habla de forma natural. Alexa te hará las preguntas necesarias para completar cada solicitud.',
            sections: [
                { title: 'Explorar', text: '“¿Qué servicios tienen?” o “Muéstrame los productos AVYNA”.' },
                { title: 'Consultar', text: '“¿Cuánto cuesta el shampoo Revitalit?” o “¿Cuál es su horario?”.' },
                { title: 'Reservar', text: '“Quiero una cita para corte de cabello mañana a las diez”.' }
            ],
            primaryAction: 'home',
            primaryLabel: 'Ver menú principal'
        }),
        token: 'ayuda'
    });
}

function renderPriceHelp(handlerInput) {
    return makeResponse(handlerInput, {
        speech: 'Claro. Dime el nombre del servicio o producto cuyo precio deseas conocer. Por ejemplo: cuánto cuesta un corte para hombre, o cuánto cuesta el shampoo Revitalit.',
        reprompt: '¿De qué servicio o producto deseas conocer el precio?',
        documentName: 'info',
        data: infoData({
            title: 'Consulta de precios',
            subtitle: 'Pregunta por un servicio o producto',
            body: 'Los precios mostrados son de referencia y pueden variar según el largo del cabello, el diseño o los materiales elegidos.',
            sections: [
                { title: 'Servicios', text: 'Cortes, uñas, tinte, maquillaje, peinado, cejas y depilación.' },
                { title: 'Productos', text: 'Shampoo, acondicionador, tratamientos y productos de peinado AVYNA.' }
            ],
            primaryAction: 'services',
            primaryLabel: 'Explorar servicios'
        }),
        token: 'precios'
    });
}

async function appointmentPrompt(draft, clientSession = {}) {
    const token = clientSession.token || '';

    if (!draft.service) {
        return {
            slot: 'servicio',
            speech: clientSession.user && clientSession.user.nombre
                ? `Perfecto ${clientSession.user.nombre}, comencemos. ¿Para qué servicio deseas la cita? Puedes decirlo por voz o tocar ver servicios para abrir el catálogo completo.`
                : 'Perfecto, comencemos. ¿Para qué servicio deseas la cita? Puedes decirlo por voz o tocar ver servicios para abrir el catálogo completo.',
            reprompt: 'Dime el servicio que deseas, por ejemplo: corte escolar, o toca ver servicios.',
            options: [
                actionOption('Ver servicios', 'services'),
                actionOption('Inicio', 'home'),
                actionOption('Salir', 'exit')
            ]
        };
    }

    const service = await resolveServiceForDraft(draft);
    if (!service) {
        draft.service = '';
        draft.serviceId = '';
        const realServices = (await getServices()).filter((item) => item.source === 'mongodb').slice(0, 3);
        return {
            slot: 'servicio',
            speech: 'No encontré ese servicio en el catálogo real. Elige un servicio disponible para poder agendar.',
            reprompt: 'Dime el nombre de un servicio disponible.',
            options: realServices.map((item) => appointmentOption(item.displayName || item.name, 'serviceId', item.id))
        };
    }

    if (!draft.day) {
        const days = nextAppointmentDays();
        return {
            slot: 'dia',
            speech: `Muy bien, una cita para ${service.name}. ¿Qué día te gustaría venir?`,
            reprompt: 'Puedes decir una fecha o tocar una opción como mañana.',
            options: days.map((day) => appointmentOption(day.label, 'day', day.value))
        };
    }

    const availableStylists = await getAvailableStylistsForDraft(token, draft);
    const availabilityText = formatStylistAvailability(availableStylists);

    if (!availableStylists.length) {
        return {
            slot: 'dia',
            speech: `No encontré estilistas disponibles para ${service.name} el ${draft.dayLabel || draft.day}. Elige otro día, por favor.`,
            reprompt: 'Dime otro día o toca una opción disponible.',
            availabilityText,
            options: nextAppointmentDays().map((day) => appointmentOption(day.label, 'day', day.value))
        };
    }

    if (!draft.stylist && !draft.stylistId) {
        return {
            slot: 'estilista',
            speech: `${availabilityText}. ¿Con qué estilista deseas tu cita?`,
            reprompt: 'Dime el nombre del estilista o toca una opción disponible.',
            availabilityText,
            options: availableStylists.slice(0, 3).map((stylist) => appointmentOption(stylist.name, 'stylistId', stylist.id))
        };
    }

    if (!draft.time) {
        const selectedStylist = findAvailableStylist(availableStylists, draft);
        if (!selectedStylist) {
            draft.stylist = '';
            draft.stylistId = '';
            return {
                slot: 'estilista',
                speech: 'No encontré ese estilista disponible para el día elegido. Selecciona uno de la lista.',
                reprompt: 'Elige un estilista disponible.',
                availabilityText,
                options: availableStylists.slice(0, 3).map((stylist) => appointmentOption(stylist.name, 'stylistId', stylist.id))
            };
        }

        draft.stylist = selectedStylist.name;
        draft.stylistId = selectedStylist.id;
        const timeOptions = firstTimeOptionsForStylist(selectedStylist);

        return {
            slot: 'hora',
            speech: `${selectedStylist.name} tiene estos horarios disponibles para el ${draft.dayLabel || draft.day}: ${timeOptions.map((option) => option.label).join(', ')}. ¿Qué hora prefieres?`,
            reprompt: 'Dime una hora o toca una opción disponible.',
            availabilityText,
            options: timeOptions.length
                ? timeOptions
                : [
                    appointmentOption('Cambiar estilista', 'stylistId', ''),
                    ...nextAppointmentDays().slice(0, 2).map((day) => appointmentOption(day.label, 'day', day.value))
                ]
        };
    }

    return null;
}
function buildAppointmentIntent(draft) {
    const values = {
        servicio: draft.service,
        tipoServicio: '',
        dia: draft.day,
        hora: draft.time,
        estilista: draft.stylist
    };

    const slots = Object.fromEntries(
        Object.entries(values).map(([name, value]) => {
            const slot = {
                name,
                confirmationStatus: 'NONE'
            };
            if (value) {
                slot.value = value;
            }
            return [name, slot];
        })
    );

    return {
        name: 'AgendarCitaIntent',
        confirmationStatus: 'NONE',
        slots
    };
}

function renderAppointmentPrompt(handlerInput, draft, prompt, useDialogDirective = true) {
    const builder = handlerInput.responseBuilder
        .speak(prompt.speech)
        .reprompt(prompt.reprompt);

    addAPLDirective(
        handlerInput,
        'appointment',
        appointmentData(draft, prompt.speech, prompt.options || [], prompt.availabilityText || ''),
        'agendar-cita'
    );

    if (useDialogDirective) {
        builder.addElicitSlotDirective(prompt.slot, buildAppointmentIntent(draft));
    }

    return builder.getResponse();
}

function mergeAppointmentDraft(handlerInput, existingDraft = {}) {
    const service = getResolvedSlotValue(handlerInput, 'servicio');
    const serviceType = getResolvedSlotValue(handlerInput, 'tipoServicio');
    const day = getResolvedSlotValue(handlerInput, 'dia');
    const time = getResolvedSlotValue(handlerInput, 'hora');
    const stylist = getResolvedSlotValue(handlerInput, 'estilista');

    let combinedService = service || existingDraft.service || '';
    if (serviceType && combinedService && !normalizeText(combinedService).includes(normalizeText(serviceType))) {
        combinedService = `${combinedService} ${serviceType}`;
    }

    return {
        ...existingDraft,
        service: combinedService,
        serviceId: service || serviceType ? '' : existingDraft.serviceId || '',
        servicePrice: service || serviceType ? '' : existingDraft.servicePrice || '',
        serviceDuration: service || serviceType ? '' : existingDraft.serviceDuration || '',
        day: day || existingDraft.day || '',
        dayLabel: day ? formatDateLabel(day) : existingDraft.dayLabel || '',
        time: time || existingDraft.time || '',
        timeLabel: time ? formatTimeLabel(time) : existingDraft.timeLabel || '',
        stylist: stylist || existingDraft.stylist || '',
        stylistId: stylist ? '' : existingDraft.stylistId || ''
    };
}

async function completeAppointment(handlerInput, draft, clientSession = null) {
    const session = clientSession && clientSession.ok
        ? clientSession
        : await ensureClientSession(handlerInput);
    if (!session.ok) {
        return session.response;
    }

    const service = await resolveServiceForDraft(draft);
    if (!service) {
        const correctedDraft = {
            ...draft,
            service: '',
            serviceId: '',
            time: '',
            timeLabel: '',
            stylist: '',
            stylistId: ''
        };
        const attributes = getSessionAttributes(handlerInput);
        attributes.appointmentDraft = correctedDraft;
        setSessionAttributes(handlerInput, attributes);
        const prompt = await appointmentPrompt(correctedDraft, session);
        return renderAppointmentPrompt(handlerInput, correctedDraft, prompt, false);
    }

    const availableStylists = await getAvailableStylistsForDraft(session.token, draft);
    const matchingStylist = findAvailableStylist(availableStylists, draft);
    const timeAvailable = matchingStylist && matchingStylist.slots.includes(draft.time);

    if (!timeAvailable) {
        const correctedDraft = {
            ...draft,
            time: '',
            timeLabel: ''
        };
        const attributes = getSessionAttributes(handlerInput);
        attributes.appointmentDraft = correctedDraft;
        setSessionAttributes(handlerInput, attributes);
        const timeOptions = firstTimeOptionsForStylist(matchingStylist || availableStylists[0]);
        const prompt = {
            slot: 'hora',
            speech: `Ese horario ya no aparece disponible. Estos son horarios reales disponibles: ${timeOptions.map((option) => option.label).join(', ')}. ¿Cuál prefieres?`,
            reprompt: 'Elige una hora disponible.',
            availabilityText: formatStylistAvailability(availableStylists),
            options: timeOptions.length
                ? timeOptions
                : nextAppointmentDays().map((day) => appointmentOption(day.label, 'day', day.value))
        };
        return renderAppointmentPrompt(handlerInput, correctedDraft, prompt, false);
    }

    const finalDraft = {
        ...draft,
        service: service.name,
        serviceId: service.id,
        stylist: matchingStylist.name,
        stylistId: matchingStylist.id
    };

    try {
        const result = await createClientAppointment(session.token, {
            servicio: service.name,
            serviceId: service.id,
            stylistId: matchingStylist.id,
            fecha: finalDraft.day,
            hora: finalDraft.time,
            notas: 'Agendada por Alexa'
        });

        const completedDraft = {
            ...finalDraft,
            complete: true,
            saved: true,
            savedId: result && result.appointment ? result.appointment.id : '',
            status: 'Cita guardada en tu cuenta de cliente.'
        };

        const attributes = getSessionAttributes(handlerInput);
        attributes.appointmentDraft = completedDraft;
        delete attributes.alexaAuth;
        delete attributes.authChallenge;
        setSessionAttributes(handlerInput, attributes);

        const summary = `${finalDraft.service}, el ${finalDraft.dayLabel || finalDraft.day}, a las ${finalDraft.timeLabel || finalDraft.time}, con ${finalDraft.stylist}.`;
        return makeResponse(handlerInput, {
            speech: `Listo. Tu cita quedó registrada para ${summary} La verás también en tu cuenta de cliente. Por seguridad cerré tu sesión temporal en Alexa. ¿Deseas hacer otra consulta?`,
            reprompt: 'Puedes volver al inicio o preguntarme por nuestros productos.',
            documentName: 'appointment',
            data: appointmentData(completedDraft, '', [
                actionOption('Inicio', 'home'),
                actionOption('Productos', 'products'),
                actionOption('Salir', 'exit')
            ]),
            token: 'cita-resultado'
        });
    } catch (error) {
        console.error('No fue posible guardar la cita en el backend:', error.message);
        const failedDraft = {
            ...finalDraft,
            status: error.message || 'No fue posible guardar la cita.'
        };
        return makeResponse(handlerInput, {
            speech: `No pude guardar la cita: ${failedDraft.status}. Puedes intentar con otro horario.`,
            reprompt: 'Elige otro horario o vuelve al inicio.',
            documentName: 'appointment',
            data: appointmentData(failedDraft, failedDraft.status, [
                appointmentOption('Cambiar hora', 'time', ''),
                appointmentOption('Cambiar día', 'day', ''),
                actionOption('Inicio', 'home')
            ]),
            token: 'cita-error'
        });
    }
}
async function startAppointmentFromButton(handlerInput, service = '') {
    const session = await ensureClientSession(handlerInput);
    if (!session.ok) {
        return session.response;
    }

    let selectedService = service;
    let selectedServiceId = '';
    if (service) {
        const item = await findService(service);
        if (item && item.source === 'mongodb') {
            selectedService = item.name;
            selectedServiceId = item.id;
        }
    }

    const attributes = getSessionAttributes(handlerInput);
    const draft = createEmptyAppointmentDraft(session.user.nombre || '');
    draft.service = selectedService;
    draft.serviceId = selectedServiceId;
    attributes.appointmentDraft = draft;
    setSessionAttributes(handlerInput, attributes);
    const prompt = await appointmentPrompt(draft, session);
    return renderAppointmentPrompt(handlerInput, draft, prompt, false);
}

async function renderAppointmentState(handlerInput, draft) {
    const session = await ensureClientSession(handlerInput);
    if (!session.ok) {
        return session.response;
    }

    const attributes = getSessionAttributes(handlerInput);
    attributes.appointmentDraft = draft;
    setSessionAttributes(handlerInput, attributes);

    const prompt = await appointmentPrompt(draft, session);
    if (prompt) {
        return renderAppointmentPrompt(handlerInput, draft, prompt, false);
    }

    return completeAppointment(handlerInput, draft, session);
}

async function applyAppointmentSelection(handlerInput, field, value) {
    const attributes = getSessionAttributes(handlerInput);
    const draft = attributes.appointmentDraft && !attributes.appointmentDraft.complete
        ? attributes.appointmentDraft
        : {
            service: '',
            serviceId: '',
            day: '',
            dayLabel: '',
            time: '',
            timeLabel: '',
            stylist: '',
            stylistId: ''
        };

    switch (field) {
        case 'service':
            draft.service = value;
            draft.serviceId = '';
            draft.day = '';
            draft.dayLabel = '';
            draft.stylist = '';
            draft.stylistId = '';
            draft.time = '';
            draft.timeLabel = '';
            break;
        case 'serviceId': {
            const services = await getServices();
            const selected = services.find((service) => String(service.id) === String(value) && service.source === 'mongodb');
            draft.service = selected ? selected.name : '';
            draft.serviceId = selected ? selected.id : '';
            draft.servicePrice = selected ? selected.price || '' : '';
            draft.serviceDuration = selected ? selected.duration || '' : '';
            draft.day = '';
            draft.dayLabel = '';
            draft.stylist = '';
            draft.stylistId = '';
            draft.time = '';
            draft.timeLabel = '';
            break;
        }
        case 'day':
            draft.day = value;
            draft.dayLabel = value ? formatDateLabel(value) : '';
            draft.stylist = '';
            draft.stylistId = '';
            draft.time = '';
            draft.timeLabel = '';
            break;
        case 'stylist':
            draft.stylist = value || '';
            draft.stylistId = '';
            draft.time = '';
            draft.timeLabel = '';
            break;
        case 'stylistId':
            draft.stylistId = value || '';
            draft.stylist = '';
            draft.time = '';
            draft.timeLabel = '';
            break;
        case 'time':
            draft.time = value;
            draft.timeLabel = value ? formatTimeLabel(value) : '';
            break;
        default:
            break;
    }

    return renderAppointmentState(handlerInput, draft);
}


function getStylistAccessToken(handlerInput) {
    const attributes = getSessionAttributes(handlerInput);
    return String(attributes.stylistAuth && attributes.stylistAuth.token || '').trim();
}

function getMexicoTodayIso() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function addDaysToIso(value, days) {
    const [year, month, day] = String(value || getMexicoTodayIso()).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function resolveStylistDateValue(value = '') {
    const raw = String(value || '').trim();
    const normalized = normalizeText(raw);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return raw;
    }
    if (raw === 'PRESENT_REF' || normalized.includes('hoy') || normalized === 'today') {
        return getMexicoTodayIso();
    }
    if (normalized.includes('manana') || normalized === 'tomorrow') {
        return addDaysToIso(getMexicoTodayIso(), 1);
    }
    return getMexicoTodayIso();
}

function formatStylistDateHint(dateValue, timeFilter = '') {
    const today = getMexicoTodayIso();
    if (dateValue === today) {
        return timeFilter ? `Filtrado a las ${formatTimeLabel(timeFilter)}.` : 'Agenda de hoy.';
    }
    if (dateValue === addDaysToIso(today, 1)) {
        return timeFilter ? `Mañana, filtrado a las ${formatTimeLabel(timeFilter)}.` : 'Agenda de mañana.';
    }
    return timeFilter ? `Filtrado a las ${formatTimeLabel(timeFilter)}.` : 'Agenda por fecha.';
}

function formatAppointmentStatusLabel(value = '') {
    const status = normalizeText(value || 'pendiente');
    if (status === 'confirmada') return 'Confirmada';
    if (status === 'completada') return 'Completada';
    if (status === 'cancelada') return 'Cancelada';
    return 'Pendiente';
}

function statusAccent(value = '') {
    const status = normalizeText(value || 'pendiente');
    if (status === 'confirmada') return ['#93E0CE', '#1F5B50'];
    if (status === 'completada') return ['#AFCBFF', '#31456D'];
    if (status === 'cancelada') return ['#FF7E9D', '#683047'];
    return ['#F0A6B8', '#51243E'];
}

function normalizeStylistAppointment(appointment) {
    const [accent, accentSoft] = statusAccent(appointment.estado);
    const contact = appointment.clienteTelefono || appointment.clienteCorreo || '';
    return {
        ...appointment,
        horaLabel: formatTimeLabel(appointment.hora || ''),
        estadoLabel: formatAppointmentStatusLabel(appointment.estado),
        contacto: contact || 'Sin contacto visible',
        accent,
        accentSoft
    };
}

function summarizeStylistAppointments(appointments, dateLabel, timeFilter = '') {
    if (!appointments.length) {
        return timeFilter
            ? `No tienes citas para ${dateLabel} a las ${formatTimeLabel(timeFilter)}.`
            : `No tienes citas asignadas para ${dateLabel}.`;
    }

    if (appointments.length === 1) {
        const appointment = appointments[0];
        return `Tienes una cita ${dateLabel} a las ${appointment.horaLabel}, con ${appointment.cliente}, para ${appointment.servicio}.`;
    }

    const firstItems = appointments.slice(0, 3)
        .map((appointment) => `${appointment.horaLabel} con ${appointment.cliente}`)
        .join('; ');
    return `Tienes ${appointments.length} citas ${dateLabel}: ${firstItems}.`;
}

function renderStylistApiError(handlerInput, error) {
    return makeResponse(handlerInput, {
        speech: error.message || 'No pude consultar el panel de estilista en este momento.',
        reprompt: 'Puedes decir volver al inicio.',
        documentName: 'info',
        data: infoData({
            title: 'Panel no disponible',
            subtitle: 'No pude conectar con tus citas',
            body: 'Alexa intentó consultar el backend real, pero no recibió una respuesta válida para el panel de estilista.',
            sections: [
                { title: 'Revisa Render', text: 'Confirma que el servidor esté activo.' },
                { title: 'Sesión', text: 'Si la sesión venció, vuelve a entrar como estilista.' }
            ],
            primaryAction: 'stylistDashboard',
            primaryLabel: 'Entrar como estilista'
        }),
        token: 'stylist-error'
    });
}

function renderStylistAuthStartPrompt(handlerInput, reason = '', speak = true) {
    const attributes = getSessionAttributes(handlerInput);
    const authInput = String(attributes.stylistAuthInput || '').replace(/\D/g, '').slice(0, 10);
    attributes.stylistAuthChallenge = {
        stage: 'identifier',
        pendingAction: 'dashboard'
    };
    delete attributes.authChallenge;
    delete attributes.authInput;
    delete attributes.authCodeInput;
    setSessionAttributes(handlerInput, attributes);

    const speech = reason
        ? `${reason} Para entrar al panel de estilista necesito validar tu cuenta. Dime tu teléfono de diez dígitos o tu correo registrado como estilista. También puedes tocar tu teléfono en pantalla.`
        : 'Para entrar al panel de estilista necesito validar tu cuenta. Dime tu teléfono de diez dígitos o tu correo registrado como estilista. También puedes tocar tu teléfono en pantalla.';
    const data = appointmentData({
        title: 'Panel de estilista',
        subtitle: 'Valida tu cuenta para ver tus citas asignadas.',
        service: 'Validar estilista',
        status: 'Dime tu teléfono o correo de estilista.',
        authMode: 'phone',
        authDigits: authInput
    }, speech, [
        actionOption('Inicio', 'home'),
        actionOption('Agendar cita', 'appointment'),
        actionOption('Salir', 'exit')
    ]);

    if (!speak) {
        addAPLDirective(handlerInput, 'appointment', data, 'validar-estilista');
        return handlerInput.responseBuilder.getResponse();
    }

    return makeResponse(handlerInput, {
        speech,
        reprompt: 'Dime tu teléfono de estilista de diez dígitos, tu correo registrado, o toca los números en pantalla.',
        documentName: 'appointment',
        data,
        token: 'validar-estilista'
    });
}

function renderStylistAuthCodePrompt(handlerInput, challenge, speechOverride = '', speak = true) {
    const attributes = getSessionAttributes(handlerInput);
    const authCodeInput = String(attributes.stylistAuthCodeInput || '').replace(/\D/g, '').slice(0, 6);
    const speech = speechOverride
        || `Te envié un código a ${challenge.delivery || 'tu correo de estilista'}. Dime el código de seis dígitos o tócalo en pantalla para abrir tu panel.`;
    const data = appointmentData({
        title: 'Panel de estilista',
        subtitle: 'Código de acceso temporal.',
        service: 'Validar código',
        status: `Código enviado a ${challenge.delivery || 'tu correo'}`,
        authMode: 'code',
        authDigits: authCodeInput
    }, speech, [
        actionOption('Reenviar código', 'authRestart'),
        actionOption('Inicio', 'home'),
        actionOption('Salir', 'exit')
    ]);

    if (!speak) {
        addAPLDirective(handlerInput, 'appointment', data, 'codigo-estilista');
        return handlerInput.responseBuilder.getResponse();
    }

    const builder = handlerInput.responseBuilder
        .speak(speech)
        .reprompt('Dime el código de seis dígitos que llegó a tu correo de estilista, o tócalo en pantalla.');

    addAPLDirective(handlerInput, 'appointment', data, 'codigo-estilista');
    builder.addElicitSlotDirective('codigoVerificacion', buildCodeVerificationIntent(authCodeInput));

    return builder.getResponse();
}

async function processStylistIdentifier(handlerInput, rawIdentifier, emptyReason = 'No alcancé a tomar tu dato de estilista.') {
    if (!hasApiConfig()) {
        return renderApiConfigRequired(handlerInput);
    }

    const identifier = normalizeSpokenIdentifier(rawIdentifier);
    if (!identifier) {
        return renderStylistAuthStartPrompt(handlerInput, emptyReason);
    }

    try {
        const challenge = await startStylistAlexaLogin(identifier);
        const attributes = getSessionAttributes(handlerInput);
        attributes.stylistAuthChallenge = {
            stage: 'code',
            challengeId: challenge.challengeId,
            delivery: challenge.delivery,
            identifier,
            pendingAction: 'dashboard'
        };
        delete attributes.stylistAuthInput;
        attributes.stylistAuthCodeInput = '';
        setSessionAttributes(handlerInput, attributes);
        return renderStylistAuthCodePrompt(handlerInput, attributes.stylistAuthChallenge);
    } catch (error) {
        console.error('No fue posible iniciar validación de estilista Alexa:', error.message);
        return renderStylistAuthStartPrompt(handlerInput, error.message || 'No pude enviar el código de estilista.');
    }
}

async function processStylistCode(handlerInput, rawCode, alternateRawCode = '') {
    const attributes = getSessionAttributes(handlerInput);
    const challenge = attributes.stylistAuthChallenge;
    if (!challenge || !challenge.challengeId) {
        return renderStylistAuthStartPrompt(handlerInput, 'Primero necesito enviarte un código de estilista.');
    }

    const candidates = [
        rawCode,
        alternateRawCode,
        getInputTranscript(handlerInput),
        extractSixDigitCodeFromRequest(handlerInput),
        attributes.stylistAuthCodeInput
    ].filter((value, index, array) => value && array.indexOf(value) === index);

    let code = '';
    for (const candidate of candidates) {
        const normalized = normalizeSpokenDigits(candidate);
        if (/^\d{6}$/.test(normalized)) {
            code = normalized;
            break;
        }
        if (!code && normalized) {
            code = normalized;
        }
    }

    if (!/^\d{6}$/.test(code)) {
        attributes.stylistAuthCodeInput = String(code || '').slice(0, 6);
        setSessionAttributes(handlerInput, attributes);
        return renderStylistAuthCodePrompt(handlerInput, challenge, 'El código debe tener seis dígitos. Dímelo nuevamente o tócalo completo en pantalla.');
    }

    try {
        const result = await verifyStylistAlexaLogin(challenge.challengeId, code);
        attributes.stylistAuth = {
            token: result.token,
            user: result.user,
            expiresInMinutes: result.expiresInMinutes
        };
        delete attributes.stylistAuthChallenge;
        delete attributes.stylistAuthInput;
        delete attributes.stylistAuthCodeInput;
        setSessionAttributes(handlerInput, attributes);
        return renderStylistDashboard(handlerInput);
    } catch (error) {
        console.error('No fue posible verificar código de estilista Alexa:', error.message);
        return renderStylistAuthCodePrompt(handlerInput, challenge, error.message || 'No pude verificar el código de estilista. Inténtalo otra vez.');
    }
}

async function handleStylistAuthDigitButton(handlerInput, digit) {
    const cleanDigit = String(digit || '').replace(/\D/g, '').slice(0, 1);
    if (!cleanDigit) {
        return renderStylistAuthStartPrompt(handlerInput, 'No reconocí ese número.');
    }

    const attributes = getSessionAttributes(handlerInput);
    const challenge = attributes.stylistAuthChallenge || { stage: 'identifier', pendingAction: 'dashboard' };

    if (challenge.stage === 'code') {
        attributes.stylistAuthCodeInput = `${attributes.stylistAuthCodeInput || ''}${cleanDigit}`.replace(/\D/g, '').slice(0, 6);
        setSessionAttributes(handlerInput, attributes);
        if (attributes.stylistAuthCodeInput.length >= 6) {
            return processStylistCode(handlerInput, attributes.stylistAuthCodeInput);
        }
        return renderStylistAuthCodePrompt(handlerInput, challenge, '', false);
    }

    attributes.stylistAuthChallenge = {
        stage: 'identifier',
        pendingAction: 'dashboard'
    };
    attributes.stylistAuthInput = `${attributes.stylistAuthInput || ''}${cleanDigit}`.replace(/\D/g, '').slice(0, 10);
    setSessionAttributes(handlerInput, attributes);
    if (attributes.stylistAuthInput.length >= 10) {
        return processStylistIdentifier(handlerInput, attributes.stylistAuthInput);
    }
    return renderStylistAuthStartPrompt(handlerInput, '', false);
}

function handleStylistAuthClearButton(handlerInput) {
    const attributes = getSessionAttributes(handlerInput);
    const challenge = attributes.stylistAuthChallenge || { stage: 'identifier' };
    if (challenge.stage === 'code') {
        attributes.stylistAuthCodeInput = '';
        setSessionAttributes(handlerInput, attributes);
        return renderStylistAuthCodePrompt(handlerInput, challenge, 'Borré el código. Captúralo nuevamente.');
    }

    attributes.stylistAuthInput = '';
    setSessionAttributes(handlerInput, attributes);
    return renderStylistAuthStartPrompt(handlerInput, 'Borré el teléfono de estilista. Captúralo nuevamente.');
}

async function handleStylistAuthSubmitButton(handlerInput) {
    const attributes = getSessionAttributes(handlerInput);
    const challenge = attributes.stylistAuthChallenge || { stage: 'identifier' };
    if (challenge.stage === 'code') {
        return processStylistCode(handlerInput, attributes.stylistAuthCodeInput || '');
    }
    return processStylistIdentifier(handlerInput, attributes.stylistAuthInput || '', 'Captura tu teléfono completo de diez dígitos.');
}

async function ensureStylistSession(handlerInput) {
    if (!hasApiConfig()) {
        return {
            ok: false,
            response: renderApiConfigRequired(handlerInput)
        };
    }

    const token = getStylistAccessToken(handlerInput);
    if (!token) {
        return {
            ok: false,
            response: renderStylistAuthStartPrompt(handlerInput)
        };
    }

    try {
        const data = await getStylistDashboardProfile(token);
        const user = data && data.user ? data.user : null;
        if (!user || user.role !== 'stylist') {
            return {
                ok: false,
                response: renderStylistAuthStartPrompt(handlerInput, 'La sesión actual no corresponde a un estilista.')
            };
        }
        return { ok: true, token, user, staff: data.staff || null };
    } catch (error) {
        console.error('No fue posible validar el estilista para Alexa:', error.message);
        return {
            ok: false,
            response: isUnauthorizedError(error)
                ? renderStylistAuthStartPrompt(handlerInput, 'Tu sesión de estilista venció o no está activa.')
                : renderStylistApiError(handlerInput, error)
        };
    }
}

async function renderStylistDashboard(handlerInput, dateValue = getMexicoTodayIso(), speechOverride = '', timeFilter = '') {
    const session = await ensureStylistSession(handlerInput);
    if (!session.ok) {
        return session.response;
    }

    try {
        const rawAppointments = await getStylistAppointments(session.token, {
            desde: dateValue,
            hasta: dateValue
        });
        let appointments = rawAppointments.map(normalizeStylistAppointment);
        if (timeFilter) {
            appointments = appointments.filter((appointment) => String(appointment.hora || '').startsWith(timeFilter.slice(0, 5)));
        }

        const dateLabel = formatDateLabel(dateValue);
        const speech = speechOverride || summarizeStylistAppointments(appointments, dateLabel, timeFilter);
        return makeResponse(handlerInput, {
            speech,
            reprompt: 'Puedes decir: mis citas de hoy, mis citas de mañana, o volver al inicio.',
            documentName: 'stylistDashboard',
            data: stylistDashboardData({
                user: session.user,
                staff: session.staff,
                appointments,
                dateLabel,
                dateHint: formatStylistDateHint(dateValue, timeFilter),
                dateValue
            }),
            token: `stylist-${dateValue}`
        });
    } catch (error) {
        console.error('No fue posible consultar citas de estilista:', error.message);
        return renderStylistApiError(handlerInput, error);
    }
}

function resolveStylistRequestDate(handlerInput) {
    const dateSlot = getResolvedSlotValue(handlerInput, 'dia');
    const transcript = getInputTranscript(handlerInput);
    return resolveStylistDateValue(dateSlot || transcript);
}

const EstilistaDashboardIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'EstilistaDashboardIntent';
    },
    async handle(handlerInput) {
        return renderStylistDashboard(handlerInput);
    }
};

const ConsultarCitasEstilistaIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ConsultarCitasEstilistaIntent';
    },
    async handle(handlerInput) {
        const dateValue = resolveStylistRequestDate(handlerInput);
        const timeFilter = getResolvedSlotValue(handlerInput, 'hora');
        return renderStylistDashboard(handlerInput, dateValue, '', timeFilter);
    }
};

const IdentificarEstilistaIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'IdentificarEstilistaIntent';
    },
    async handle(handlerInput) {
        const slotValue = getResolvedSlotValue(handlerInput, 'identificadorEstilista');
        const transcript = getInputTranscript(handlerInput);
        return processStylistIdentifier(handlerInput, slotValue || transcript);
    }
};

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const attributes = getSessionAttributes(handlerInput);
        delete attributes.appointmentDraft;
        delete attributes.alexaAuth;
        delete attributes.authChallenge;
        delete attributes.authInput;
        delete attributes.authCodeInput;
        delete attributes.stylistAuth;
        delete attributes.stylistAuthChallenge;
        delete attributes.stylistAuthInput;
        delete attributes.stylistAuthCodeInput;
        setSessionAttributes(handlerInput, attributes);

        return renderWelcome(
            handlerInput,
            'Bienvenido a Estética Panamericana. Aquí puedes conocer nuestros servicios y productos, consultar precios y horarios, o solicitar una cita. ¿Qué te gustaría hacer?'
        );
    }
};

const NavigateHomeIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.NavigateHomeIntent';
    },
    handle(handlerInput) {
        return renderWelcome(handlerInput, 'Volvemos al inicio. ¿Qué deseas consultar?');
    }
};

const ConsultarServiciosIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ConsultarServiciosIntent';
    },
    async handle(handlerInput) {
        const service = getResolvedSlotValue(handlerInput, 'servicio');
        const serviceType = getResolvedSlotValue(handlerInput, 'tipoServicio');
        const query = [service, serviceType].filter(Boolean).join(' ');

        if (!query) {
            return renderCatalog(handlerInput, 'service');
        }

        const item = await findService(query);
        if (item) {
            return renderItemDetail(handlerInput, item, 'service');
        }

        return renderCatalog(
            handlerInput,
            'service',
            `No encontré información exacta para ${query}, pero te muestro todos nuestros servicios disponibles.`
        );
    }
};

const ConsultarProductosIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ConsultarProductosIntent';
    },
    async handle(handlerInput) {
        const product = getResolvedSlotValue(handlerInput, 'producto');

        if (!product) {
            return renderCatalog(handlerInput, 'product');
        }

        const item = await findProduct(product);
        if (item) {
            return renderItemDetail(handlerInput, item, 'product');
        }

        return renderCatalog(
            handlerInput,
            'product',
            `No encontré ${product} en el catálogo, pero te mostraré los productos disponibles.`
        );
    }
};

const ConsultarPreciosIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ConsultarPreciosIntent';
    },
    async handle(handlerInput) {
        const product = getResolvedSlotValue(handlerInput, 'producto');
        const service = getResolvedSlotValue(handlerInput, 'servicio');

        if (product) {
            const item = await findProduct(product);
            if (item) {
                return renderItemDetail(
                    handlerInput,
                    item,
                    'product',
                    `${item.displayName || item.name} tiene un precio de ${item.price}. ${item.description}`
                );
            }
        }

        if (service) {
            const item = await findService(service);
            if (item) {
                return renderItemDetail(
                    handlerInput,
                    item,
                    'service',
                    `${item.name} tiene un precio de ${item.price}${item.duration ? ` y una duración aproximada de ${item.duration}` : ''}.`
                );
            }
        }

        if (product || service) {
            const requested = product || service;
            return makeResponse(handlerInput, {
                speech: `No encontré el precio de ${requested}. Puedes probar con otro nombre o explorar el catálogo.`,
                reprompt: '¿Quieres ver servicios o productos?',
                documentName: 'info',
                data: infoData({
                    title: 'Precio no encontrado',
                    subtitle: requested,
                    body: 'Es posible que el artículo tenga otro nombre en el catálogo.',
                    sections: [
                        { title: 'Sugerencia', text: 'Explora las opciones disponibles y toca una para ver su precio.' }
                    ],
                    primaryAction: product ? 'products' : 'services',
                    primaryLabel: product ? 'Ver productos' : 'Ver servicios'
                }),
                token: 'precio-no-encontrado'
            });
        }

        return renderPriceHelp(handlerInput);
    }
};

const ConsultarHorariosIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ConsultarHorariosIntent';
    },
    handle(handlerInput) {
        return renderHours(handlerInput);
    }
};

function normalizeSpanishNumberText(value = '') {
    return normalizeText(value)
        .replace(/\buno cientos\b/g, 'ciento')
        .replace(/\buna cientos\b/g, 'ciento')
        .replace(/\bdos cientos\b/g, 'doscientos')
        .replace(/\btres cientos\b/g, 'trescientos')
        .replace(/\bcuatro cientos\b/g, 'cuatrocientos')
        .replace(/\bcinco cientos\b/g, 'quinientos')
        .replace(/\bseis cientos\b/g, 'seiscientos')
        .replace(/\bsiete cientos\b/g, 'setecientos')
        .replace(/\bocho cientos\b/g, 'ochocientos')
        .replace(/\bnueve cientos\b/g, 'novecientos')
        .replace(/\bsete cientos\b/g, 'setecientos')
        .replace(/\bveinte y uno\b/g, 'veintiuno')
        .replace(/\bveinte y dos\b/g, 'veintidos')
        .replace(/\bveinte y tres\b/g, 'veintitres')
        .replace(/\bveinte y cuatro\b/g, 'veinticuatro')
        .replace(/\bveinte y cinco\b/g, 'veinticinco')
        .replace(/\bveinte y seis\b/g, 'veintiseis')
        .replace(/\bveinte y siete\b/g, 'veintisiete')
        .replace(/\bveinte y ocho\b/g, 'veintiocho')
        .replace(/\bveinte y nueve\b/g, 'veintinueve')
        .replace(/\bdiez y seis\b/g, 'dieciseis')
        .replace(/\bdiez y siete\b/g, 'diecisiete')
        .replace(/\bdiez y ocho\b/g, 'dieciocho')
        .replace(/\bdiez y nueve\b/g, 'diecinueve');
}
function parseSpanishNumberWords(value = '') {
    const normalized = normalizeSpanishNumberText(value);
    const words = normalized.split(' ').filter(Boolean);
    if (!words.length) {
        return null;
    }

    const units = {
        un: 1,
        uno: 1,
        una: 1,
        dos: 2,
        tres: 3,
        cuatro: 4,
        cinco: 5,
        seis: 6,
        siete: 7,
        ocho: 8,
        nueve: 9,
        diez: 10,
        once: 11,
        doce: 12,
        trece: 13,
        catorce: 14,
        quince: 15,
        dieciseis: 16,
        diecisiete: 17,
        dieciocho: 18,
        diecinueve: 19,
        veinte: 20,
        veintiuno: 21,
        veintiun: 21,
        veintidos: 22,
        veintitres: 23,
        veinticuatro: 24,
        veinticinco: 25,
        veintiseis: 26,
        veintisiete: 27,
        veintiocho: 28,
        veintinueve: 29
    };
    const tens = {
        treinta: 30,
        cuarenta: 40,
        cincuenta: 50,
        sesenta: 60,
        setenta: 70,
        ochenta: 80,
        noventa: 90
    };
    const hundreds = {
        cien: 100,
        ciento: 100,
        doscientos: 200,
        trescientos: 300,
        cuatrocientos: 400,
        quinientos: 500,
        seiscientos: 600,
        setecientos: 700,
        ochocientos: 800,
        novecientos: 900
    };
    const numberTokens = words.filter((word) => (
        word === 'y'
        || word === 'mil'
        || units[word] !== undefined
        || tens[word] !== undefined
        || hundreds[word] !== undefined
    ));

    if (!numberTokens.length) {
        return null;
    }

    function parseUnderThousand(tokens) {
        return tokens.reduce((total, word) => {
            if (word === 'y') {
                return total;
            }
            if (units[word] !== undefined) {
                return total + units[word];
            }
            if (tens[word] !== undefined) {
                return total + tens[word];
            }
            if (hundreds[word] !== undefined) {
                return total + hundreds[word];
            }
            return total;
        }, 0);
    }

    const milIndex = numberTokens.indexOf('mil');
    if (milIndex >= 0) {
        const beforeMil = numberTokens.slice(0, milIndex);
        const afterMil = numberTokens.slice(milIndex + 1);
        const thousands = beforeMil.length ? parseUnderThousand(beforeMil) : 1;
        return (thousands * 1000) + parseUnderThousand(afterMil);
    }

    return parseUnderThousand(numberTokens);
}

function normalizeSpokenDigits(value = '') {
    const digitWords = {
        cero: '0',
        uno: '1',
        una: '1',
        dos: '2',
        tres: '3',
        cuatro: '4',
        cinco: '5',
        seis: '6',
        siete: '7',
        ocho: '8',
        nueve: '9'
    };
    const raw = String(value || '');
    const numericDigits = raw.replace(/\D/g, '');
    if (numericDigits) {
        return numericDigits;
    }

    const normalized = normalizeSpanishNumberText(raw);
    const words = normalized.split(' ').filter(Boolean);
    const spokenDigitWords = words.filter((word) => digitWords[word] !== undefined);
    if (spokenDigitWords.length && spokenDigitWords.length === words.length) {
        return spokenDigitWords.map((word) => digitWords[word]).join('');
    }

    const parsedNumber = parseSpanishNumberWords(raw);
    if (parsedNumber !== null && Number.isFinite(parsedNumber)) {
        return String(parsedNumber);
    }

    return spokenDigitWords.map((word) => digitWords[word]).join('');
}
function normalizeSpokenIdentifier(value = '') {
    const raw = String(value || '').trim();
    let emailLike = raw
        .toLowerCase()
        .replace(/\s+arroba\s+/g, '@')
        .replace(/\s+punto\s+/g, '.')
        .replace(/\s+guion bajo\s+/g, '_')
        .replace(/\s+guion\s+/g, '-')
        .replace(/\s+/g, '');

    emailLike = emailLike
        .replace(/^micorreoes/, '')
        .replace(/^correo(es)?/, '')
        .replace(/^email(es)?/, '')
        .replace(/^mail(es)?/, '');

    if (emailLike.includes('@')) {
        return emailLike;
    }

    const digits = normalizeSpokenDigits(raw);
    return digits.length > 10 ? digits.slice(-10) : digits;
}
function createEmptyAppointmentDraft(clientName = '') {
    return {
        clientName,
        service: '',
        serviceId: '',
        day: '',
        dayLabel: '',
        time: '',
        timeLabel: '',
        stylist: '',
        stylistId: ''
    };
}

const IdentificarClienteIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'IdentificarClienteIntent';
    },
    async handle(handlerInput) {
        const slotValue = getResolvedSlotValue(handlerInput, 'identificadorCliente');
        const transcript = getInputTranscript(handlerInput);
        return processClientIdentifier(handlerInput, slotValue || transcript);
    }
};
const VerificarCodigoAlexaIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'VerificarCodigoAlexaIntent';
    },
    async handle(handlerInput) {
        const attributes = getSessionAttributes(handlerInput);
        const stylistChallenge = attributes.stylistAuthChallenge;
        const challenge = attributes.authChallenge;
        const slotValue = getResolvedSlotValue(handlerInput, 'codigoVerificacion');
        const transcript = getInputTranscript(handlerInput);

        if (stylistChallenge && stylistChallenge.stage === 'identifier') {
            return processStylistIdentifier(handlerInput, slotValue || transcript);
        }

        if (stylistChallenge && stylistChallenge.stage === 'code') {
            return processStylistCode(handlerInput, slotValue, transcript);
        }

        if (challenge && challenge.stage === 'identifier') {
            return processClientIdentifier(handlerInput, slotValue || transcript);
        }

        return processClientCode(handlerInput, slotValue, transcript);
    }
};
const AgendarCitaIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AgendarCitaIntent';
    },
    async handle(handlerInput) {
        const session = await ensureClientSession(handlerInput);
        if (!session.ok) {
            return session.response;
        }

        const attributes = getSessionAttributes(handlerInput);
        const currentDraft = attributes.appointmentDraft && !attributes.appointmentDraft.complete
            ? attributes.appointmentDraft
            : {};
        const draft = mergeAppointmentDraft(handlerInput, currentDraft);

        attributes.appointmentDraft = draft;
        setSessionAttributes(handlerInput, attributes);

        const prompt = await appointmentPrompt(draft, session);
        if (prompt) {
            return renderAppointmentPrompt(handlerInput, draft, prompt);
        }

        return completeAppointment(handlerInput, draft, session);
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        return renderHelp(handlerInput);
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && [
                'AMAZON.CancelIntent',
                'AMAZON.StopIntent'
            ].includes(Alexa.getIntentName(handlerInput.requestEnvelope));
    },
    handle(handlerInput) {
        clearAlexaAuth(handlerInput);
        return makeResponse(handlerInput, {
            speech: 'Gracias por visitar Estética Panamericana. Fue un gusto ayudarte. ¡Hasta pronto!',
            documentName: 'goodbye',
            data: goodbyeData(),
            token: 'salida',
            shouldEndSession: true
        });
    }
};

const APLUserEventHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'Alexa.Presentation.APL.UserEvent';
    },
    async handle(handlerInput) {
        const args = handlerInput.requestEnvelope.request.arguments || [];
        const action = args[0];
        const value = args[1] || '';
        console.log(`APL UserEvent recibido. Acción: ${action}. Argumentos: ${JSON.stringify(args)}`);

        switch (action) {
            case 'home':
                return renderWelcome(handlerInput, 'Aquí tienes nuevamente el menú principal. ¿Qué deseas hacer?');
            case 'services':
                return renderCatalog(handlerInput, 'service');
            case 'products':
                return renderCatalog(handlerInput, 'product');
            case 'catalogPage':
                return renderCatalog(handlerInput, value, '', args[2] || 0);
            case 'prices':
                return renderPriceHelp(handlerInput);
            case 'hours':
                return renderHours(handlerInput);
            case 'appointment':
                return startAppointmentFromButton(handlerInput);
            case 'stylistDashboard':
                return renderStylistDashboard(handlerInput);
            case 'stylistAppointments':
                return renderStylistDashboard(handlerInput, resolveStylistDateValue(value));
            case 'stylistLogout':
                clearStylistSession(handlerInput);
                return renderWelcome(handlerInput, 'Cerré la sesión de estilista. Volvemos al inicio. ¿Qué deseas consultar?');
            case 'authRestart':
                if (getSessionAttributes(handlerInput).stylistAuthChallenge) {
                    return renderStylistAuthStartPrompt(handlerInput, 'De acuerdo, te enviaré un código nuevo de estilista.');
                }
                return renderAuthStartPrompt(handlerInput, 'De acuerdo, te enviaré un código nuevo.');
            case 'authDigit':
                return handleAuthDigitButton(handlerInput, value);
            case 'authClear':
                return handleAuthClearButton(handlerInput);
            case 'authSubmit':
                return handleAuthSubmitButton(handlerInput);
            case 'appointmentSet':
                return applyAppointmentSelection(handlerInput, value, args[2] || '');
            case 'help':
                return renderHelp(handlerInput);
            case 'exit':
                clearAlexaAuth(handlerInput);
                return makeResponse(handlerInput, {
                    speech: 'De acuerdo. Gracias por visitar Estética Panamericana. ¡Hasta pronto!',
                    documentName: 'goodbye',
                    data: goodbyeData(),
                    token: 'salida',
                    shouldEndSession: true
                });
            case 'showItem': {
                const kind = value;
                const name = args[2] || '';
                const items = kind === 'product' ? await getProducts() : await getServices();
                const item = findItem(items, name);
                return item
                    ? renderItemDetail(handlerInput, item, kind)
                    : renderCatalog(handlerInput, kind);
            }
            case 'bookItem':
                return startAppointmentFromButton(handlerInput, value);
            default:
                return renderWelcome(handlerInput, 'No reconocí esa opción. Te muestro el menú principal.');
        }
    }
};

const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    async handle(handlerInput) {
        const attributes = getSessionAttributes(handlerInput);
        const stylistChallenge = attributes.stylistAuthChallenge;
        const challenge = attributes.authChallenge;
        const transcript = getInputTranscript(handlerInput);

        if (stylistChallenge && stylistChallenge.stage === 'identifier') {
            return processStylistIdentifier(handlerInput, transcript);
        }

        if (stylistChallenge && stylistChallenge.stage === 'code') {
            return processStylistCode(handlerInput, transcript);
        }

        if (challenge && challenge.stage === 'identifier') {
            return processClientIdentifier(handlerInput, transcript);
        }

        if (challenge && challenge.stage === 'code') {
            return processClientCode(handlerInput, transcript);
        }

        return makeResponse(handlerInput, {
            speech: `No entendí por completo. ${HELP_SPEECH}`,
            reprompt: '¿Quieres consultar servicios, productos, horarios o agendar una cita?',
            documentName: 'welcome',
            data: welcomeData(),
            token: 'fallback'
        });
    }
};
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`Sesión finalizada: ${JSON.stringify(handlerInput.requestEnvelope.request)}`);
        return handlerInput.responseBuilder.getResponse();
    }
};

const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        console.warn(`Intent sin handler específico: ${intentName}`);
        return renderWelcome(
            handlerInput,
            'Todavía no tengo una respuesta para esa opción. Puedo ayudarte con servicios, productos, precios, horarios y citas.'
        );
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.error('Error controlado por el skill:', error);
        return makeResponse(handlerInput, {
            speech: 'Lo siento, tuve un problema al procesar tu solicitud. Intentemos de nuevo. Puedes decir: volver al inicio.',
            reprompt: 'Di volver al inicio para ver las opciones.',
            documentName: 'info',
            data: infoData({
                title: 'Algo no salió bien',
                subtitle: 'Podemos intentarlo nuevamente',
                body: 'Vuelve al menú principal y elige otra opción.',
                sections: [],
                primaryAction: 'home',
                primaryLabel: 'Volver al inicio'
            }),
            token: 'error'
        });
    }
};

const skillHandler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        NavigateHomeIntentHandler,
        ConsultarServiciosIntentHandler,
        ConsultarProductosIntentHandler,
        ConsultarPreciosIntentHandler,
        ConsultarHorariosIntentHandler,
        EstilistaDashboardIntentHandler,
        ConsultarCitasEstilistaIntentHandler,
        IdentificarEstilistaIntentHandler,
        IdentificarClienteIntentHandler,
        VerificarCodigoAlexaIntentHandler,
        AgendarCitaIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        APLUserEventHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler
    )
    .addErrorHandlers(ErrorHandler)
    .withCustomUserAgent('estetica-panamericana/apl/v1.0')
    .lambda();

exports.handler = (event, context, callback) => {
    if (context) {
        context.callbackWaitsForEmptyEventLoop = false;
    }
    return skillHandler(event, context, callback);
};





