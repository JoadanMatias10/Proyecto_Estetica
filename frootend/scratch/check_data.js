
const fs = require('fs');
const path = 'c:/Users/Joada/OneDrive/Documentos/Proyecto_Estetica_Panamericana/frootend/src/Administrador/Reportes/ModeloPredictivo.jsx';
const content = fs.readFileSync(path, 'utf8');

// Busquemos si hay datos inyectados para pruebas
if (content.includes('// MOCK DATA')) {
    console.log('Encontrado mock data');
}
