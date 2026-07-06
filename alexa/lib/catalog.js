'use strict';

const { hasMongoConfig, withDatabase } = require('./mongo');

const catalogCache = new Map();
const CATALOG_CACHE_MS = 60 * 1000;

const FALLBACK_SERVICES = [
    {
        id: 'corte-hombre',
        name: 'Corte para hombre',
        aliases: ['corte hombre', 'corte masculino', 'corte de caballero'],
        price: '$100 MXN',
        duration: '30 minutos',
        description: 'Corte personalizado de acuerdo con tu estilo y tipo de cabello.',
        image: ''
    },
    {
        id: 'corte-nino',
        name: 'Corte para niño',
        aliases: ['corte niño', 'corte infantil'],
        price: '$80 MXN',
        duration: '25 minutos',
        description: 'Corte infantil cómodo, cuidadoso y adaptado al estilo deseado.',
        image: ''
    },
    {
        id: 'corte-mujer',
        name: 'Corte para mujer',
        aliases: ['corte mujer', 'corte femenino', 'corte de dama'],
        price: '$120 MXN',
        duration: '40 minutos',
        description: 'Corte y definición de estilo con asesoría según el tipo de rostro.',
        image: ''
    },
    {
        id: 'unas',
        name: 'Uñas',
        aliases: ['uñas acrílicas', 'uñas de gel', 'arreglo de uñas'],
        price: '$250 MXN',
        duration: '1 hora',
        description: 'Servicio de uñas con preparación, diseño y acabado profesional.',
        image: ''
    },
    {
        id: 'tinte',
        name: 'Aplicación de tinte',
        aliases: ['tinte', 'coloración', 'aplicacion de tinte'],
        price: '$350 MXN',
        duration: '2 horas',
        description: 'Aplicación uniforme de color. El precio puede variar según el largo del cabello.',
        image: ''
    },
    {
        id: 'maquillaje',
        name: 'Maquillaje',
        aliases: ['maquillaje social', 'make up'],
        price: 'Consultar',
        duration: '1 hora',
        description: 'Maquillaje personalizado para eventos y ocasiones especiales.',
        image: ''
    },
    {
        id: 'peinado',
        name: 'Peinado',
        aliases: ['peinado especial', 'peinado para evento'],
        price: 'Consultar',
        duration: '1 hora',
        description: 'Peinado adaptado a tu evento, estilo y tipo de cabello.',
        image: ''
    },
    {
        id: 'tratamiento-capilar',
        name: 'Tratamiento capilar',
        aliases: ['hidratación capilar', 'reparación capilar'],
        price: 'Consultar',
        duration: '45 minutos',
        description: 'Tratamiento para hidratar, nutrir y mejorar la apariencia del cabello.',
        image: ''
    },
    {
        id: 'planchado-ceja',
        name: 'Planchado de ceja',
        aliases: ['laminado de ceja', 'ceja laminada'],
        price: '$100 MXN',
        duration: '30 minutos',
        description: 'Definición y fijación de la ceja para un acabado ordenado y natural.',
        image: ''
    },
    {
        id: 'diseno-ceja',
        name: 'Diseño de ceja',
        aliases: ['diseño de cejas', 'arreglo de ceja'],
        price: '$80 MXN',
        duration: '25 minutos',
        description: 'Diseño personalizado para resaltar la forma natural de tus cejas.',
        image: ''
    },
    {
        id: 'depilacion',
        name: 'Depilación',
        aliases: ['depilar', 'servicio de depilación'],
        price: '$100 MXN',
        duration: '30 minutos',
        description: 'Depilación cuidadosa para obtener una piel suave y un acabado limpio.',
        image: ''
    }
];

const FALLBACK_PRODUCTS = [
    {
        id: 'shampoo-revitalit',
        name: 'Shampoo Revitalit',
        aliases: ['shampoo', 'champú', 'shampoo avyna'],
        price: '$180 MXN',
        description: 'Shampoo AVYNA recomendado para limpiar el cabello y ayudar a mantenerlo saludable.',
        image: ''
    },
    {
        id: 'acondicionador-revitalit',
        name: 'Acondicionador Revitalit',
        aliases: ['acondicionador', 'acondicionador avyna'],
        price: '$170 MXN',
        description: 'Acondicionador AVYNA que ayuda a suavizar el cabello y facilitar el peinado.',
        image: ''
    },
    {
        id: 'tratamiento-revitalit',
        name: 'Tratamiento capilar Revitalit',
        aliases: ['tratamiento capilar', 'tratamiento avyna', 'mascarilla capilar'],
        price: '$220 MXN',
        description: 'Tratamiento AVYNA para hidratar, fortalecer y mejorar el brillo del cabello.',
        image: ''
    },
    {
        id: 'crema-peinar',
        name: 'Crema para peinar',
        aliases: ['crema de peinar', 'crema avyna'],
        price: '$150 MXN',
        description: 'Crema para ayudar a controlar el frizz y dar forma al cabello.',
        image: ''
    },
    {
        id: 'gel-fijador',
        name: 'Gel fijador',
        aliases: ['gel', 'gel avyna'],
        price: '$120 MXN',
        description: 'Gel de fijación para mantener el peinado durante más tiempo.',
        image: ''
    },
    {
        id: 'ampolleta-capilar',
        name: 'Ampolleta capilar',
        aliases: ['ampolleta', 'ampolleta avyna'],
        price: '$90 MXN',
        description: 'Ampolleta capilar para brindar reparación, suavidad y brillo.',
        image: ''
    },
    {
        id: 'spray-fijador',
        name: 'Spray fijador',
        aliases: ['spray', 'laca', 'fijador'],
        price: 'Consultar',
        description: 'Spray para fijar el peinado con un acabado ligero y duradero.',
        image: ''
    },
    {
        id: 'protector-termico',
        name: 'Protector térmico',
        aliases: ['protector de calor', 'protector para plancha'],
        price: 'Consultar',
        description: 'Ayuda a proteger el cabello antes de usar secadora, plancha o tenaza.',
        image: ''
    }
];

const FALLBACK_STYLISTS = [];

function firstDefined(source, keys, fallback = '') {
    for (const key of keys) {
        if (source && source[key] !== undefined && source[key] !== null && source[key] !== '') {
            return source[key];
        }
    }
    return fallback;
}

function normalizeText(value = '') {
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9ñ\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function slugify(value) {
    return normalizeText(value).replace(/\s+/g, '-');
}

function formatPrice(value) {
    if (typeof value === 'number') {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
            maximumFractionDigits: 0
        }).format(value);
    }

    if (value && typeof value === 'object') {
        const amount = firstDefined(value, ['monto', 'amount', 'valor', 'value']);
        if (amount !== '') {
            return formatPrice(Number(amount));
        }
    }

    return value ? String(value) : 'Consultar';
}

function normalizeImage(value) {
    if (Array.isArray(value)) {
        value = value[0];
    }

    if (value && typeof value === 'object') {
        value = firstDefined(value, ['url', 'secure_url', 'src', 'href']);
    }

    const image = value ? String(value).trim() : '';
    if (!/^https:\/\//i.test(image)) {
        return '';
    }

    if (image.includes('res.cloudinary.com/') && image.includes('/upload/')) {
        return image.replace(
            '/upload/',
            '/upload/f_jpg,q_auto:good,c_fill,g_auto,w_900,h_650/'
        );
    }

    return image;
}

function normalizeGallery(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((item) => normalizeImage(item))
        .filter(Boolean)
        .slice(0, 6);
}

function formatMeasurement(document) {
    const amount = firstDefined(document, ['cantidadMedida', 'cantidad', 'size', 'contenido']);
    const unit = firstDefined(document, ['unidadMedida', 'unidad', 'unit']);
    if (amount === '' || amount === undefined || amount === null) {
        return '';
    }
    return `${amount}${unit ? ` ${unit}` : ''}`;
}

function normalizeDocument(document, type) {
    const name = String(firstDefined(
        document,
        type === 'product'
            ? ['nombre', 'name', 'producto', 'titulo', 'title']
            : ['nombre', 'name', 'servicio', 'titulo', 'title'],
        type === 'product' ? 'Producto' : 'Servicio'
    ));

    const aliasesValue = firstDefined(document, ['sinonimos', 'synonyms', 'aliases'], []);
    const brand = String(firstDefined(document, ['marca', 'brand'], ''));
    const category = String(firstDefined(
        document,
        type === 'product'
            ? ['categoria', 'category']
            : ['subcategoria', 'categoria', 'category'],
        ''
    ));
    const segment = type === 'service'
        ? String(firstDefined(document, ['segmento', 'segment', 'publico'], ''))
        : '';
    const measurement = type === 'product' ? formatMeasurement(document) : '';
    const aliases = [
        ...(Array.isArray(aliasesValue) ? aliasesValue.map(String) : []),
        brand && `${brand} ${name}`,
        category && `${name} ${category}`,
        segment && `${name} ${segment}`,
        measurement && `${name} ${measurement}`
    ].filter(Boolean);
    const image = normalizeImage(firstDefined(
        document,
        ['imagen', 'image', 'imageUrl', 'imageURL', 'urlImagen', 'foto', 'photo', 'url'],
        ''
    ));
    const gallery = normalizeGallery(firstDefined(
        document,
        ['galeriaImagenes', 'gallery', 'imagenes'],
        []
    ));
    const displayName = measurement ? `${name} · ${measurement}` : name;

    return {
        id: String(firstDefined(document, ['id', 'slug', 'codigo', 'sku', '_id'], slugify(name))),
        name,
        displayName,
        aliases,
        price: formatPrice(firstDefined(document, ['precio', 'price', 'costo', 'cost'], 'Consultar')),
        description: String(firstDefined(
            document,
            ['descripcion', 'description', 'detalle', 'details', 'beneficios'],
            type === 'product'
                ? 'Producto disponible en Estética Panamericana.'
                : 'Servicio disponible en Estética Panamericana.'
        )),
        duration: type === 'service'
            ? String(firstDefined(document, ['duracion', 'duration', 'tiempo'], 'Consultar'))
            : '',
        image: image || gallery[0] || '',
        gallery,
        brand,
        category,
        segment,
        measurement,
        stock: type === 'product'
            ? Number(firstDefined(document, ['stock', 'existencia', 'inventory'], 0))
            : 0,
        rating: type === 'product'
            ? Number(firstDefined(document, ['rating', 'calificacion', 'score'], 0))
            : 0,
        featured: Boolean(firstDefined(document, ['destacadoInicio', 'featured', 'destacado'], false))
    };
}

async function loadCollection(collectionName, type, fallback) {
    const cacheKey = `${type}:${collectionName}`;
    const cached = catalogCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.items;
    }

    const mongoConfigured = hasMongoConfig();
    const documents = await withDatabase(
        async (database) => database.collection(collectionName)
            .find({})
            .sort({ destacadoInicio: -1, nombre: 1, cantidadMedida: 1 })
            .limit(100)
            .toArray(),
        null
    );

    const databaseAvailable = Array.isArray(documents);
    const items = databaseAvailable && documents.length
        ? documents.map((document) => ({
            ...normalizeDocument(document, type),
            source: 'mongodb'
        }))
        : fallback.map((item) => ({
            ...item,
            displayName: item.displayName || item.name,
            source: databaseAvailable
                ? 'mongodb-empty'
                : (mongoConfigured ? 'fallback' : 'configuration-missing')
        }));

    catalogCache.set(cacheKey, {
        items,
        expiresAt: Date.now() + CATALOG_CACHE_MS
    });

    return items;
}

async function getProducts() {
    const collection = process.env.MONGODB_PRODUCTOS_COLLECTION || 'productos';
    return loadCollection(collection, 'product', FALLBACK_PRODUCTS);
}

async function getServices() {
    const collection = process.env.MONGODB_SERVICIOS_COLLECTION || 'servicios';
    return loadCollection(collection, 'service', FALLBACK_SERVICES);
}

function scoreMatch(item, query) {
    const normalizedQuery = normalizeText(query);
    const candidates = [
        item.id,
        item.name,
        item.displayName,
        item.brand,
        item.category,
        item.segment,
        ...(item.aliases || [])
    ].filter(Boolean).map(normalizeText);

    if (!normalizedQuery) {
        return 0;
    }
    if (candidates.includes(normalizedQuery)) {
        return 100;
    }
    if (candidates.some((candidate) => candidate.includes(normalizedQuery))) {
        return 75;
    }
    if (candidates.some((candidate) => normalizedQuery.includes(candidate))) {
        return 60;
    }

    const words = normalizedQuery.split(' ');
    return Math.max(
        0,
        ...candidates.map((candidate) => words.filter((word) => candidate.includes(word)).length * 10)
    );
}

function findItem(items, query) {
    if (!query) {
        return null;
    }

    const ranked = items
        .map((item) => ({ item, score: scoreMatch(item, query) }))
        .sort((left, right) => right.score - left.score);

    return ranked[0] && ranked[0].score >= 20 ? ranked[0].item : null;
}

async function findProduct(query) {
    return findItem(await getProducts(), query);
}

async function findService(query) {
    return findItem(await getServices(), query);
}

function normalizeBoolean(value, fallback = true) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    return !['false', '0', 'no', 'inactivo', 'inactive'].includes(normalizeText(value));
}

function normalizeTime(value, fallback = '') {
    if (!value) {
        return fallback;
    }

    const text = String(value).trim();
    const match = text.match(/^(\d{1,2})(?::(\d{2}))?/);
    if (!match) {
        return fallback;
    }

    let hours = Number(match[1]);
    const minutes = Number(match[2] || 0);
    const lower = normalizeText(text);
    if (lower.includes('pm') || lower.includes('p m') || lower.includes('tarde')) {
        if (hours < 12) {
            hours += 12;
        }
    }
    if ((lower.includes('am') || lower.includes('a m') || lower.includes('manana')) && hours === 12) {
        hours = 0;
    }

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return fallback;
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function timeToMinutes(value) {
    const time = normalizeTime(value);
    if (!time) {
        return 0;
    }
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

function minutesToTime(value) {
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getWeekdayIndex(dateValue) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue || '')) {
        return -1;
    }
    const [year, month, day] = dateValue.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

function normalizeDays(value) {
    if (value === undefined || value === null || value === '') {
        return [];
    }

    const values = Array.isArray(value) ? value : [value];
    const dayMap = {
        domingo: 0,
        dom: 0,
        sunday: 0,
        lunes: 1,
        lun: 1,
        monday: 1,
        martes: 2,
        mar: 2,
        tuesday: 2,
        miercoles: 3,
        miércoles: 3,
        mie: 3,
        wednesday: 3,
        jueves: 4,
        jue: 4,
        thursday: 4,
        viernes: 5,
        vie: 5,
        friday: 5,
        sabado: 6,
        sábado: 6,
        sab: 6,
        saturday: 6
    };

    return values.flatMap((item) => {
        if (typeof item === 'number') {
            return [item];
        }
        const normalized = normalizeText(item);
        if (dayMap[normalized] !== undefined) {
            return [dayMap[normalized]];
        }
        return [];
    }).filter((day) => day >= 0 && day <= 6);
}

function normalizeAvailability(value) {
    if (!value) {
        return [];
    }

    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === 'object') {
        return Object.entries(value).map(([key, entry]) => ({
            ...(entry && typeof entry === 'object' ? entry : {}),
            dia: key
        }));
    }

    return [];
}

function normalizeStylist(document) {
    const name = String(firstDefined(
        document,
        ['nombre', 'name', 'nombreCompleto', 'fullName', 'estilista', 'displayName'],
        'Estilista'
    ));
    const aliasesValue = firstDefined(document, ['sinonimos', 'synonyms', 'aliases'], []);
    const availabilityValue = firstDefined(document, ['disponibilidad', 'availability', 'horarios', 'schedule'], []);

    return {
        id: String(firstDefined(document, ['id', 'slug', 'codigo', 'sku', '_id'], slugify(name))),
        name,
        aliases: [
            ...(Array.isArray(aliasesValue) ? aliasesValue.map(String) : []),
            `con ${name}`,
            `estilista ${name}`
        ],
        active: normalizeBoolean(firstDefined(document, ['activo', 'active', 'disponible', 'available'], true), true),
        defaultStart: normalizeTime(firstDefined(document, ['horaEntrada', 'entrada', 'startTime', 'inicio'], '09:00'), '09:00'),
        defaultEnd: normalizeTime(firstDefined(document, ['horaSalida', 'salida', 'endTime', 'fin'], '19:00'), '19:00'),
        defaultDays: normalizeDays(firstDefined(document, ['dias', 'diasDisponibles', 'days', 'availableDays'], [1, 2, 3, 4, 5, 6])),
        availability: normalizeAvailability(availabilityValue)
    };
}

async function getStylists() {
    const collection = process.env.MONGODB_ESTILISTAS_COLLECTION
        || process.env.MONGODB_STYLISTS_COLLECTION
        || 'estilistas';
    const documents = await withDatabase(
        async (database) => database.collection(collection)
            .find({})
            .sort({ nombre: 1, name: 1 })
            .limit(50)
            .toArray(),
        null
    );

    if (Array.isArray(documents) && documents.length) {
        return documents.map(normalizeStylist).filter((stylist) => stylist.active);
    }

    return [];
}

function findStylistInList(stylists, query) {
    if (!query) {
        return null;
    }
    const normalizedQuery = normalizeText(query);
    if (['cualquiera', 'sin preferencia', 'estilista disponible', 'el disponible'].includes(normalizedQuery)) {
        return {
            id: 'sin-preferencia',
            name: 'sin preferencia',
            aliases: [],
            active: true,
            defaultStart: '09:00',
            defaultEnd: '19:00',
            defaultDays: [1, 2, 3, 4, 5, 6],
            availability: []
        };
    }

    return findItem(stylists, query);
}

async function findStylist(query) {
    return findStylistInList(await getStylists(), query);
}

function availabilityAppliesToDate(entry, dateValue) {
    const exactDate = String(firstDefined(entry, ['fecha', 'date', 'diaFecha'], ''));
    if (exactDate && exactDate === dateValue) {
        return true;
    }

    const weekday = getWeekdayIndex(dateValue);
    const days = normalizeDays(firstDefined(entry, ['dia', 'dias', 'day', 'days', 'weekday'], []));
    return days.includes(weekday);
}

function scheduleForStylist(stylist, dateValue) {
    const weekday = getWeekdayIndex(dateValue);
    const defaultDays = stylist.defaultDays && stylist.defaultDays.length
        ? stylist.defaultDays
        : [1, 2, 3, 4, 5, 6];
    let schedule = defaultDays.includes(weekday)
        ? { start: stylist.defaultStart || '09:00', end: stylist.defaultEnd || '19:00' }
        : null;

    for (const entry of stylist.availability || []) {
        if (!availabilityAppliesToDate(entry, dateValue)) {
            continue;
        }

        const unavailable = !normalizeBoolean(firstDefined(entry, ['activo', 'active', 'disponible', 'available'], true), true)
            || normalizeBoolean(firstDefined(entry, ['bloqueado', 'blocked', 'cerrado', 'closed'], false), false);
        if (unavailable) {
            schedule = null;
            continue;
        }

        schedule = {
            start: normalizeTime(firstDefined(entry, ['horaEntrada', 'entrada', 'startTime', 'inicio', 'desde'], stylist.defaultStart), stylist.defaultStart),
            end: normalizeTime(firstDefined(entry, ['horaSalida', 'salida', 'endTime', 'fin', 'hasta'], stylist.defaultEnd), stylist.defaultEnd)
        };
    }

    return schedule;
}

function generateSlots(startTime, endTime) {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    const slots = [];
    for (let cursor = start; cursor <= end - 30; cursor += 60) {
        slots.push(minutesToTime(cursor));
    }
    return slots;
}

async function getBookedSlots(dateValue) {
    const collection = process.env.MONGODB_CITAS_COLLECTION || 'citas';
    return withDatabase(async (database) => {
        const appointments = await database.collection(collection)
            .find({
                $or: [
                    { dia: dateValue },
                    { fecha: dateValue },
                    { date: dateValue }
                ],
                estado: { $nin: ['cancelada', 'cancelado', 'rechazada', 'rechazado'] }
            })
            .limit(200)
            .toArray();

        return appointments.map((appointment) => ({
            stylist: normalizeText(firstDefined(appointment, ['estilista', 'stylist', 'estilistaNombre'], '')),
            time: normalizeTime(firstDefined(appointment, ['hora', 'time', 'horaTexto'], ''))
        }));
    }, []);
}

async function getAvailableStylists(dateValue, stylistQuery = '') {
    const stylists = await getStylists();
    const requestedStylist = findStylistInList(stylists, stylistQuery);
    const filteredStylists = requestedStylist && requestedStylist.id !== 'sin-preferencia'
        ? stylists.filter((stylist) => stylist.id === requestedStylist.id)
        : stylists;
    const bookedSlots = await getBookedSlots(dateValue);

    return filteredStylists.map((stylist) => {
        const schedule = scheduleForStylist(stylist, dateValue);
        const bookedForStylist = bookedSlots
            .filter((slot) => slot.stylist === normalizeText(stylist.name))
            .map((slot) => slot.time);
        const slots = schedule
            ? generateSlots(schedule.start, schedule.end).filter((slot) => !bookedForStylist.includes(slot))
            : [];

        return {
            ...stylist,
            startTime: schedule ? schedule.start : '',
            endTime: schedule ? schedule.end : '',
            slots,
            available: slots.length > 0
        };
    }).filter((stylist) => stylist.available);
}

async function saveAppointment(_appointment) {
    console.warn('saveAppointment directo a MongoDB esta deshabilitado. Usa el backend real /api/client/appointments.');
    return {
        saved: false,
        id: '',
        error: 'disabled-direct-mongo-write'
    };
}
module.exports = {
    getProducts,
    getServices,
    findProduct,
    findService,
    findItem,
    getStylists,
    findStylist,
    getAvailableStylists,
    saveAppointment,
    normalizeText
};
