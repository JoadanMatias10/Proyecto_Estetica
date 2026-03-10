export const PRODUCT_CATEGORIES = {
    "Necesidades": [
        "Reestructuración",
        "Cuidado del color",
        "Hidratación",
        "Crecimiento y caída",
        "Cuidado para cabello rubio",
        "Cuero cabelludo graso",
        "Protección térmica",
        "Peinado",
        "Coloración"
    ],
    "Cabello": [
        "Ialuronico",
        "Di Argan",
        "Di Goji",
        "Platino",
        "Abbondanza",
        "Di Agave",
        "Tratamientos especiales",
        "Zenzero",
        "Xtyling"
    ],
    "Mondo Verde": [
        "Shampoo Solido",
        "Maschera Solido"
    ],
    "Piel": [
        "Rostro"
    ],
    "Maquillaje": [
        "Cara",
        "Ojos",
        "Labios",
        "Herramientas"
    ]
};

export const getAllCategories = () => {
    return Object.keys(PRODUCT_CATEGORIES);
};

export const getSubcategories = (category) => {
    return PRODUCT_CATEGORIES[category] || [];
};
