'use strict';

const welcomeDocument = require('../apl/welcome.json');
const listDocument = require('../apl/list.json');
const detailDocument = require('../apl/detail.json');
const infoDocument = require('../apl/info.json');
const appointmentDocument = require('../apl/appointment.json');
const goodbyeDocument = require('../apl/goodbye.json');
const stylistDashboardDocument = require('../apl/stylistDashboard.json');

const DOCUMENTS = {
    welcome: welcomeDocument,
    list: listDocument,
    detail: detailDocument,
    info: infoDocument,
    appointment: appointmentDocument,
    goodbye: goodbyeDocument,
    stylistDashboard: stylistDashboardDocument
};

function supportsAPL(handlerInput) {
    const interfaces = handlerInput.requestEnvelope.context
        && handlerInput.requestEnvelope.context.System
        && handlerInput.requestEnvelope.context.System.device
        && handlerInput.requestEnvelope.context.System.device.supportedInterfaces;

    return Boolean(interfaces && interfaces['Alexa.Presentation.APL']);
}

function addAPLDirective(handlerInput, documentName, properties, token = documentName) {
    if (!supportsAPL(handlerInput) || !DOCUMENTS[documentName]) {
        return handlerInput.responseBuilder;
    }

    return handlerInput.responseBuilder.addDirective({
        type: 'Alexa.Presentation.APL.RenderDocument',
        token: `estetica-${token}`,
        document: DOCUMENTS[documentName],
        datasources: {
            screenData: {
                type: 'object',
                objectId: `estetica-${documentName}`,
                properties
            }
        }
    });
}

function menuItems() {
    return [
        {
            title: 'Servicios',
            subtitle: 'Cortes, color y belleza',
            accent: '#F0A6B8',
            icon: '✦',
            action: 'services'
        },
        {
            title: 'Productos',
            subtitle: 'Catálogo con imágenes',
            accent: '#E8C078',
            icon: '◇',
            action: 'products'
        },
        {
            title: 'Precios',
            subtitle: 'Consulta costos',
            accent: '#C99BE8',
            icon: '$',
            action: 'prices'
        },
        {
            title: 'Horarios',
            subtitle: 'Planea tu visita',
            accent: '#92D4C4',
            icon: '◷',
            action: 'hours'
        },
        {
            title: 'Agendar cita',
            subtitle: 'Reserva por voz',
            accent: '#FF7E9D',
            icon: '+',
            action: 'appointment'
        },
        {
            title: 'Ayuda',
            subtitle: 'Descubre qué decir',
            accent: '#AFCBFF',
            icon: '?',
            action: 'help'
        },
        {
            title: 'Salir',
            subtitle: 'Cerrar la skill',
            accent: '#F0A6B8',
            icon: '×',
            action: 'exit'
        }
    ];
}

function welcomeData() {
    return {
        brand: 'ESTÉTICA PANAMERICANA',
        eyebrow: 'BELLEZA · CUIDADO · ESTILO',
        title: 'Tu momento comienza aquí',
        subtitle: 'Servicios profesionales, productos especializados y citas en un solo lugar.',
        hint: 'Prueba diciendo: “Alexa, muéstrame los productos”',
        version: 'CATÁLOGO 2.2',
        menu: menuItems()
    };
}

function listData({
    title,
    subtitle,
    kind,
    items,
    totalItems = items.length,
    page = 0,
    totalPages = 1
}) {
    return {
        brand: 'ESTÉTICA PANAMERICANA',
        title,
        subtitle,
        kind,
        totalItems,
        page,
        pageNumber: page + 1,
        totalPages,
        previousPage: Math.max(0, page - 1),
        nextPage: Math.min(totalPages - 1, page + 1),
        hasPrevious: page > 0,
        hasNext: page < totalPages - 1,
        emptyMessage: `Por el momento no hay ${kind === 'product' ? 'productos' : 'servicios'} para mostrar.`,
        items: items.map((item) => ({
            id: item.id,
            name: item.name,
            displayName: item.displayName || item.name,
            price: item.price,
            duration: item.duration || '',
            image: item.image || '',
            brand: item.brand || '',
            category: item.category || '',
            segment: item.segment || '',
            measurement: item.measurement || '',
            stock: item.stock || 0,
            rating: item.rating || 0,
            featured: Boolean(item.featured),
            kind
        }))
    };
}

function detailData({ item, kind }) {
    return {
        brand: 'ESTÉTICA PANAMERICANA',
        kind,
        category: kind === 'product' ? 'PRODUCTO' : 'SERVICIO',
        title: item.displayName || item.name,
        description: item.description,
        price: item.price,
        duration: item.duration || '',
        image: item.image || '',
        gallery: item.gallery || [],
        meta: kind === 'product'
            ? [item.brand, item.category, item.rating ? `★ ${item.rating}` : ''].filter(Boolean).join('  ·  ')
            : [item.segment, item.category].filter(Boolean).join('  ·  '),
        availability: kind === 'product'
            ? (item.stock > 0 ? `${item.stock} disponibles` : 'Consulta disponibilidad')
            : '',
        primaryAction: kind === 'service' ? 'bookItem' : 'products',
        primaryLabel: kind === 'service' ? 'Agendar este servicio' : 'Ver más productos',
        itemName: item.name
    };
}

function infoData({ title, subtitle, body, sections = [], primaryAction = 'home', primaryLabel = 'Volver al inicio' }) {
    const detailText = [
        body,
        ...sections.map((section) => `${section.title}: ${section.text}`)
    ].filter(Boolean).join('\n\n');

    return {
        brand: 'ESTÉTICA PANAMERICANA',
        title,
        subtitle,
        body,
        sections,
        detailText,
        primaryAction,
        primaryLabel
    };
}

function appointmentData(draft = {}, prompt = '', options = [], availabilityText = '') {
    const steps = [
        { label: 'Servicio', value: draft.service || 'Por elegir', complete: Boolean(draft.service) },
        { label: 'Día', value: draft.dayLabel || draft.day || 'Por elegir', complete: Boolean(draft.day) },
        { label: 'Hora', value: draft.timeLabel || draft.time || 'Por elegir', complete: Boolean(draft.time) },
        { label: 'Estilista', value: draft.stylist || 'Sin preferencia', complete: Boolean(draft.stylist) }
    ];
    const summaryText = steps
        .map((step) => `${step.label}: ${step.value}`)
        .join('\n');
    const normalizedOptions = [0, 1, 2].map((index) => options[index] || {
        label: '',
        action: 'noop',
        field: '',
        value: '',
        enabled: false
    });
    const authMode = draft.authMode || '';
    const authDigits = String(draft.authDigits || '').replace(/\D/g, '').slice(0, authMode === 'code' ? 6 : 10);
    const authTargetLength = authMode === 'code' ? 6 : 10;
    const authDisplay = authDigits || (authMode === 'code' ? 'Código de 6 dígitos' : 'Teléfono de 10 dígitos');

    return {
        brand: 'ESTÉTICA PANAMERICANA',
        title: draft.title || (draft.complete ? 'Solicitud registrada' : 'Agenda tu cita'),
        subtitle: draft.complete
            ? 'Guardamos los datos de tu solicitud.'
            : 'Te guiaré paso a paso. Puedes responder usando tu voz o tocando la pantalla.',
        prompt,
        status: draft.status || '',
        complete: Boolean(draft.complete),
        availabilityText,
        summaryText: availabilityText ? `${summaryText}\n\n${availabilityText}` : summaryText,
        authMode: Boolean(authMode),
        authKind: authMode,
        authTitle: authMode === 'code' ? 'Código de verificación' : 'Teléfono registrado',
        authInstruction: authMode === 'code'
            ? 'Toca el código de 6 dígitos que llegó a tu correo.'
            : 'Toca tu teléfono registrado de 10 dígitos o dilo por voz.',
        authDigits,
        authDisplay,
        authProgress: `${authDigits.length}/${authTargetLength}`,
        authCanSubmit: authDigits.length === authTargetLength,
        option1Label: normalizedOptions[0].label,
        option1Action: normalizedOptions[0].action,
        option1Field: normalizedOptions[0].field,
        option1Value: normalizedOptions[0].value,
        option1Enabled: Boolean(normalizedOptions[0].enabled),
        option2Label: normalizedOptions[1].label,
        option2Action: normalizedOptions[1].action,
        option2Field: normalizedOptions[1].field,
        option2Value: normalizedOptions[1].value,
        option2Enabled: Boolean(normalizedOptions[1].enabled),
        option3Label: normalizedOptions[2].label,
        option3Action: normalizedOptions[2].action,
        option3Field: normalizedOptions[2].field,
        option3Value: normalizedOptions[2].value,
        option3Enabled: Boolean(normalizedOptions[2].enabled),
        step1Label: steps[0].label,
        step1Value: steps[0].value,
        step2Label: steps[1].label,
        step2Value: steps[1].value,
        step3Label: steps[2].label,
        step3Value: steps[2].value,
        step4Label: steps[3].label,
        step4Value: steps[3].value,
        steps
    };
}

function stylistDashboardData({
    user = {},
    staff = null,
    appointments = [],
    dateLabel = '',
    dateHint = 'Consulta por voz o usando los botones.',
    dateValue = ''
} = {}) {
    const displayName = [user.nombre, user.apellidoPaterno].filter(Boolean).join(' ')
        || (staff && staff.nombre)
        || 'estilista';
    const normalizedAppointments = appointments.map((appointment) => ({
        id: appointment.id || '',
        cliente: appointment.cliente || 'Cliente',
        contacto: appointment.contacto || appointment.clienteTelefono || appointment.clienteCorreo || 'Sin contacto visible',
        servicio: appointment.servicio || 'Servicio',
        horaLabel: appointment.horaLabel || appointment.hora || '',
        estadoLabel: appointment.estadoLabel || appointment.estado || 'Pendiente',
        notas: appointment.notas || '',
        accent: appointment.accent || '#F0A6B8',
        accentSoft: appointment.accentSoft || '#51243E'
    }));
    const total = normalizedAppointments.length;

    return {
        brand: 'ESTÃ‰TICA PANAMERICANA',
        title: 'Panel de estilista',
        subtitle: `Hola ${displayName}. Estas son tus citas asignadas.`,
        dateLabel,
        dateHint,
        dateValue,
        total,
        totalLabel: total === 1 ? 'cita' : 'citas',
        hasAppointments: total > 0,
        emptyMessage: `No tienes citas asignadas para ${dateLabel || 'esta fecha'}.`,
        appointments: normalizedAppointments,
        footerHint: 'Puedes decir: "mis citas de hoy", "mis citas de mañana" o "qué cita tengo a las diez".'
    };
}

function goodbyeData() {
    return {
        brand: 'ESTÉTICA PANAMERICANA',
        title: 'Gracias por visitarnos',
        subtitle: 'Fue un gusto ayudarte. Regresa cuando quieras para descubrir servicios, productos o agendar una cita.',
        footer: 'Tu estilo, tu momento.'
    };
}

module.exports = {
    supportsAPL,
    addAPLDirective,
    welcomeData,
    listData,
    detailData,
    infoData,
    appointmentData,
    stylistDashboardData,
    goodbyeData
};


