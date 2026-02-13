

const { initializeDatabase } = require('./schema');
const { generatedKeysRepo, licenseRepo } = require('./db-sqlite');
initializeDatabase();
module.exports = {
    generatedKeysRepo,
    licenseRepo
};
